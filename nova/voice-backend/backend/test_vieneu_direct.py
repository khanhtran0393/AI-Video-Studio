from pathlib import Path
import numpy as np
import soundfile as sf

# tạo mẫu ref từ mock-style (giả), 2s
sr = 24000
import math
N = sr * 2
a = []
for i in range(N):
    t = i / sr
    a.append(0.2 * math.sin(2*math.pi*440*t))
    
ref = Path('d:/AI Video Studio/nova/voice-backend/backend/test_ref.wav')
sf.write(ref, np.array(a, dtype='float32'), sr)

from engines.vieneu import VieNeuEngine
from engines.base import TTSRequest

# built-in voice
engine = VieNeuEngine()
out1 = Path('d:/AI Video Studio/nova/voice-backend/backend/test_builtin.wav')
req1 = TTSRequest(text='Xin chào, đây là kiểm tra giọng mặc định của VieNeu.', attributes={'voice':'Adam'})
engine.synthesize(req1, out1)
print('builtin:', out1, out1.exists(), out1.stat().st_size)

# clone bằng ref_audio
out2 = Path('d:/AI Video Studio/nova/voice-backend/backend/test_clone.wav')
req2 = TTSRequest(text='Đây là thử nghiệm clone giọng từ file mẫu.', ref_audio=str(ref), ref_text='Xin chào, đây là file mẫu.', attributes={})
engine.synthesize(req2, out2)
print('clone:', out2, out2.exists(), out2.stat().st_size)
