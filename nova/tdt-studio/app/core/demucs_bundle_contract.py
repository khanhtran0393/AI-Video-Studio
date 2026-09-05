'Hợp đồng flavor torch CUDA cho bundle Demucs — không nạp torch.'
from __future__ import annotations
from dataclasses import dataclass
PINNED_TORCH_VERSION = '2.6.0+cu124'
PINNED_CUDA_VERSION = '12.4'

@dataclass(frozen=True)
class TorchCudaFlavor:
    ok: 'bool'
    version: 'str'
    cuda_version: 'str | None'
    detail: 'str'

def check_torch_cuda_flavor(*, version: str, cuda_version: str | None) -> TorchCudaFlavor:
    ver = str(version or '')
    cuda = None if cuda_version is None else str(cuda_version)
    ok = ver == PINNED_TORCH_VERSION and cuda == PINNED_CUDA_VERSION
    detail = f'{ver} cuda={cuda}'
    return TorchCudaFlavor(ok=ok, version=ver, cuda_version=cuda, detail=detail)