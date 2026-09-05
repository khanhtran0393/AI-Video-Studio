import os
from pathlib import Path
base=Path(r'D:\AI Video Studio\nova\voice-backend\.venv-omni')
print('VENV_EXISTS',base.exists())

def size_dir(p: Path):
    total=0
    for root,_,files in os.walk(p):
        for f in files:
            fp=Path(root)/f
            try:
                total += fp.stat().st_size
            except OSError:
                pass
    return total

sp=base/'Lib'/'site-packages'
torchlib=sp/'torch'/'lib'
print('VENV_TOTAL_BYTES='+str(size_dir(base)))
print('SITE_PACKAGES_BYTES='+str(size_dir(sp)))
print('TORCH_LIB_BYTES='+str(size_dir(torchlib)))
print('VENV_TOTAL_GB={:.4f}'.format(size_dir(base)/1024/1024/1024))
print('SP_GB={:.4f}'.format(size_dir(sp)/1024/1024/1024))
print('TORCH_LIB_GB={:.4f}'.format(size_dir(torchlib)/1024/1024/1024))
