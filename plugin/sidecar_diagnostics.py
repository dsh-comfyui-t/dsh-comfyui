"""Bounded local Sidecar diagnostics. No request bodies or configuration dumps."""
import atexit
import datetime
import faulthandler
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import re
import sys
import threading
import time
import traceback
import uuid

LIMIT=3*1024*1024
BACKUPS=3

def redact(value):
    text=str(value)
    text=re.sub(r'(?i)(Bearer\s+)[^\s\"\'<>]+',r'\1[REDACTED]',text)
    text=re.sub(r'''(?ix)((?:api[_-]?key|access[_-]?token|token|password|authorization)["']?\s*[:=]\s*["']?)[^\s"'&,}]+''',r'\1[REDACTED]',text)
    return re.sub(r'\bsk-[a-zA-Z0-9_-]{12,}\b','[REDACTED]',text)[:65536]

class SafeFormatter(logging.Formatter):
    def format(self,record):return redact(super().format(record))

def make_logger(path,limit=LIMIT,backups=BACKUPS):
    logger=logging.Logger('sidecar-'+uuid.uuid4().hex,logging.INFO)
    handler=RotatingFileHandler(path,maxBytes=limit,backupCount=backups,encoding='utf8',delay=True)
    handler.setFormatter(SafeFormatter('%(message)s'));logger.addHandler(handler)
    # A full/read-only disk must not turn a diagnostic write into a service error.
    handler.handleError=lambda record:None
    return logger

class LogStream:
    def __init__(self,logger,label,original):
        self.logger,self.label,self.original=logger,label,original
        self.pending='';self.lock=threading.RLock();self.encoding='utf-8';self.errors='replace'
    def write(self,text):
        text=str(text)
        with self.lock:
            if getattr(self.original,'isatty',lambda:False)():
                try:self.original.write(text)
                except (OSError,ValueError):pass
            self.pending+=text
            while '\n' in self.pending or len(self.pending)>=4096:
                if '\n' in self.pending and self.pending.index('\n')<4096:line,self.pending=self.pending.split('\n',1)
                else:line,self.pending=self.pending[:4096],self.pending[4096:]
                if line:self.logger.info('%s %s %s',utc(),self.label,line)
        return len(text)
    def flush(self):
        with self.lock:
            if self.pending:self.logger.info('%s %s %s',utc(),self.label,self.pending);self.pending=''
    def isatty(self):return False
    def fileno(self):return self.original.fileno()
    @property
    def closed(self):return False

def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds')

def memory_snapshot():
    if os.name=='nt':
        import ctypes
        from ctypes import wintypes
        class Memory(ctypes.Structure):
            _fields_=[('length',wintypes.DWORD),('load',wintypes.DWORD)]+[(key,ctypes.c_ulonglong) for key in ('total','free','commitTotal','commitFree','virtualTotal','virtualFree','extendedFree')]
        m=Memory();m.length=ctypes.sizeof(m)
        if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m)):return {}
        result={'ramTotal':m.total,'ramFree':m.free,'commitFree':m.commitFree,'memoryPercent':m.load}
        class Counters(ctypes.Structure):
            _fields_=[('size',wintypes.DWORD),('faults',wintypes.DWORD)]+[(key,ctypes.c_size_t) for key in ('peakWorkingSet','workingSet','peakPagedPool','pagedPool','peakNonPagedPool','nonPagedPool','pagefile','peakPagefile','privateUsage')]
        counters=Counters();counters.size=ctypes.sizeof(counters)
        ctypes.windll.kernel32.GetCurrentProcess.restype=wintypes.HANDLE
        get_memory=ctypes.windll.psapi.GetProcessMemoryInfo;get_memory.argtypes=[wintypes.HANDLE,ctypes.c_void_p,wintypes.DWORD]
        if get_memory(ctypes.windll.kernel32.GetCurrentProcess(),ctypes.byref(counters),ctypes.sizeof(counters)):
            result.update(processRSS=counters.workingSet,processPrivate=counters.privateUsage)
        return result
    result={}
    try:
        values={line.split(':',1)[0]:int(line.split()[1])*1024 for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith(('MemTotal:','MemAvailable:'))}
        result={'ramTotal':values['MemTotal'],'ramFree':values['MemAvailable']}
        for line in Path('/proc/self/status').read_text().splitlines():
            if line.startswith('VmRSS:'):result['processRSS']=int(line.split()[1])*1024
    except (OSError,ValueError,KeyError):pass
    return result

def pid_alive(pid):
    if not isinstance(pid,int) or pid<=0:return None
    if os.name=='nt':
        import ctypes
        from ctypes import wintypes
        kernel=ctypes.windll.kernel32
        kernel.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD];kernel.OpenProcess.restype=wintypes.HANDLE
        kernel.GetExitCodeProcess.argtypes=[wintypes.HANDLE,ctypes.POINTER(wintypes.DWORD)];kernel.CloseHandle.argtypes=[wintypes.HANDLE]
        handle=kernel.OpenProcess(0x1000,False,pid)
        if not handle:return False if kernel.GetLastError()==87 else None
        try:
            code=wintypes.DWORD()
            return code.value==259 if kernel.GetExitCodeProcess(handle,ctypes.byref(code)) else None
        finally:kernel.CloseHandle(handle)
    try:os.kill(pid,0);return True
    except ProcessLookupError:return False
    except (PermissionError,OSError):return None

class SidecarDiagnostics:
    def __init__(self,root,interval=30,redirect=True):
        self.folder=Path(root)/'logs';self.folder.mkdir(parents=True,exist_ok=True)
        self.runtime=make_logger(self.folder/'sidecar-runtime.log');self.events=make_logger(self.folder/'sidecar-events.jsonl')
        self.run_id=uuid.uuid4().hex;self.started=utc();self.interval=interval;self.stop_event=threading.Event();self.thread=None
        self.ready_state=None;self.finished=False;self.lock=threading.RLock();self.state_file=self.folder/'sidecar-last-run.json'
        self.original_out,self.original_err=sys.stdout,sys.stderr
        self.original_hook,self.original_thread_hook,self.original_unraisable=sys.excepthook,threading.excepthook,sys.unraisablehook
        self.fault=None
        if redirect:sys.stdout=LogStream(self.runtime,'stdout',sys.stdout);sys.stderr=LogStream(self.runtime,'stderr',sys.stderr)
        sys.excepthook=self._exception;threading.excepthook=self._thread_exception;sys.unraisablehook=self._unraisable
        self.event('process_start',parentPid=os.getppid(),platform=sys.platform,python=sys.version.split()[0])
        try:
            path=self.folder/'sidecar-fault.log'
            if path.exists() and path.stat().st_size>=LIMIT:
                for index in range(BACKUPS,0,-1):
                    old=path if index==1 else Path(str(path)+'.'+str(index-1));new=Path(str(path)+'.'+str(index))
                    if old.exists():os.replace(old,new)
            self.fault=path.open('a',encoding='utf8');self.fault.write('\n'+utc()+' pid='+str(os.getpid())+' run='+self.run_id+'\n');self.fault.flush()
            faulthandler.enable(self.fault,all_threads=True)
        except (OSError,RuntimeError):self.event('fault_handler_unavailable')
        atexit.register(self._atexit)
    def event(self,event,**fields):
        self.events.info(json.dumps({'time':utc(),'event':event,'pid':os.getpid(),'run':self.run_id,**fields},ensure_ascii=False,default=str))
    def _trace(self,typ,value,tb):self.runtime.error('%s %s',utc(),''.join(traceback.format_exception(typ,value,tb)))
    def _exception(self,typ,value,tb):
        self._trace(typ,value,tb);self.finish('uncaught_exception',1,exception=typ.__name__)
    def _thread_exception(self,args):
        if args.exc_type is SystemExit:return
        self.event('thread_exception',thread=args.thread.name if args.thread else '',exception=args.exc_type.__name__);self._trace(args.exc_type,args.exc_value,args.exc_traceback)
    def _unraisable(self,args):
        self.event('unraisable_exception',exception=args.exc_type.__name__);self._trace(args.exc_type,args.exc_value,args.exc_traceback)
    def _state(self,status,**extra):
        row={'pid':os.getpid(),'run':self.run_id,'started':self.started,'lastSeen':utc(),'status':status,**(self.ready_state or {}),**extra}
        temp=self.state_file.with_name('.sidecar-state-'+self.run_id+'.tmp')
        try:temp.write_text(json.dumps(row,ensure_ascii=False),encoding='utf8');os.replace(temp,self.state_file)
        except OSError:pass
        finally:
            try:temp.unlink(missing_ok=True)
            except OSError:pass
    def ready(self,port,instance):
        with self.lock:
            if self.ready_state:return
            try:
                previous=json.loads(self.state_file.read_text(encoding='utf8'))
                if isinstance(previous,dict) and previous.get('status')=='running' and previous.get('pid')!=os.getpid():
                    alive=pid_alive(previous.get('pid'))
                    self.event('previous_run_unclean' if alive is False else 'previous_run_unconfirmed',previousPid=previous.get('pid'),previousRun=previous.get('run'),lastSeen=previous.get('lastSeen'),pidAlive=alive)
            except (OSError,ValueError,TypeError):pass
            self.ready_state={'port':port,'instanceId':instance};self.event('listening',**self.ready_state)
            self._heartbeat();self.thread=threading.Thread(target=self._loop,name='sidecar-diagnostics',daemon=True);self.thread.start()
    def _heartbeat(self):
        try:memory=memory_snapshot()
        except Exception:memory={}
        with self.lock:
            if not self.finished:self.event('heartbeat',**memory);self._state('running',memory=memory)
    def _loop(self):
        while not self.stop_event.wait(self.interval):self._heartbeat()
    def finish(self,reason,code,**extra):
        with self.lock:
            if self.finished:return
            self.finished=True;self.stop_event.set();self.event('process_exit',reason=reason,code=code,**extra)
            if self.ready_state:self._state('exited',exitReason=reason,exitCode=code)
            for stream in (sys.stdout,sys.stderr):
                if isinstance(stream,LogStream):stream.flush()
    def run(self,main):
        try:code=main()
        except KeyboardInterrupt:self.finish('keyboard_interrupt',130);return 130
        except SystemExit as error:
            code=error.code if isinstance(error.code,int) else 1 if error.code else 0
            self.finish('system_exit',code);raise
        except BaseException as error:
            self._trace(type(error),error,error.__traceback__);self.finish('uncaught_exception',1,exception=type(error).__name__);return 1
        self.finish('normal_return' if not code else 'startup_failed',code or 0);return code
    def _atexit(self):self.finish('interpreter_exit',None)
    def close(self):
        self.finish('diagnostics_closed',0);atexit.unregister(self._atexit)
        if self.thread:self.thread.join(timeout=1)
        sys.excepthook=self.original_hook
        threading.excepthook=self.original_thread_hook;sys.unraisablehook=self.original_unraisable
        if isinstance(sys.stdout,LogStream):sys.stdout=self.original_out
        if isinstance(sys.stderr,LogStream):sys.stderr=self.original_err
        if self.fault:
            faulthandler.disable();self.fault.close()
        for logger in (self.runtime,self.events):
            for handler in logger.handlers:handler.close()

def install(root):
    try:return SidecarDiagnostics(root)
    except OSError as error:
        try:print('Sidecar diagnostics unavailable: '+str(error),file=sys.stderr)
        except (OSError,ValueError):pass
        return None
