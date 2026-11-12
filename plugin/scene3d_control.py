"""Bounded, window-scoped loopback scene command bridge (no GUI dependency)."""
from collections import OrderedDict
import copy, re, threading, time

class SceneControl:
    def __init__(self):
        self.lock=threading.RLock();self.queue=[];self.results=OrderedDict();self.last={};self.seq=0

    @staticmethod
    def channel(value):
        value=value or ''
        if not isinstance(value,str) or (value and not re.fullmatch(r'[a-zA-Z0-9_-]{8,80}',value)):
            raise ValueError('场景窗口编号无效')
        return value

    def enqueue(self,operations,channel=''):
        channel=self.channel(channel)
        if not isinstance(operations,list) or not 1<=len(operations)<=256:
            raise ValueError('控制指令无效')
        with self.lock:
            if len(self.queue)>=20:raise ValueError('场景指令队列已满，请等待处理')
            self.seq+=1
            item={'id':'ctl-%d'%self.seq,'operations':copy.deepcopy(operations),'channel':channel}
            self.queue.append(item)
            return item['id']

    def pending(self,channel=''):
        channel=self.channel(channel)
        with self.lock:
            # Old callers omit the target. The first polling window claims the
            # command once; another window must never apply the same command.
            for item in self.queue:
                if channel and not item['channel']:item['channel']=channel
            return copy.deepcopy([item for item in self.queue if item['channel']==channel])

    def done(self,payload):
        if not isinstance(payload,dict):raise ValueError('场景指令结果无效')
        channel=self.channel(payload.get('channel'))
        with self.lock:
            item=next((item for item in self.queue if item['id']==payload.get('id') and item['channel']==channel),None)
            if item is None:raise ValueError('场景指令不属于当前窗口或已处理')
            result={key:copy.deepcopy(payload.get(key)) for key in ('id','snapshot','applied','error','screenshot')}
            screenshot=result.get('screenshot')
            if screenshot is not None and (not isinstance(screenshot,str) or len(screenshot)>8*1024*1024):
                raise ValueError('场景回传截图过大')
            result.update(channel=channel,at=time.time())
            self.queue.remove(item);self.last=result
            self.results[channel]=result;self.results.move_to_end(channel)
            while len(self.results)>8:self.results.popitem(last=False)
            return len(self.queue)

    def last_result(self,channel=''):
        channel=self.channel(channel)
        with self.lock:return copy.deepcopy(self.results.get(channel,{}) if channel else self.last)
