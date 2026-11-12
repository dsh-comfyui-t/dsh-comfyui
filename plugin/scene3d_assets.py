"""Revalidate immutable local editor resources without serving stale code."""
def asset_etag(path):
    stat=path.stat()
    return '"%x-%x"' % (stat.st_mtime_ns,stat.st_size)
