'\nelevenlabs_engine.py — ElevenLabs TTS Engine.\nAPI: POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}\nDocs: https://elevenlabs.io/docs/api-reference/text-to-speech/convert\nHỗ trợ multi-key rotation: truyền nhiều key (ngăn | hoặc newline) → tự xoay\nkhi key hết quota / lỗi 429.\n'
from __future__ import annotations
import os
import threading
from typing import Callable
_P = 'https://storage.googleapis.com/eleven-public-prod/premade/voices'
_PREMADE_IDS: 'set[str]' = set()
ELEVENLABS_VOICES: 'list[tuple[str, str]]' = [('EXAVITQu4vr4xnSDxMaL', '🆓 Sarah – Trưởng thành, Tự tin (Nữ)'), ('hpp4J3VqNfWAUOO0d1Us', '🆓 Bella – Chuyên nghiệp, Ấm áp (Nữ)'), ('pFZP5JQG7iQjIQuC4Bku', '🆓 Lily – Diễn viên, Nhung mượt (Nữ, Anh)'), ('Xb7hH8MSUJpSbSDYk0k2', '🆓 Alice – Rõ ràng, Giáo viên (Nữ, Anh)'), ('cgSgspJ2msm6clMCkdW9', '🆓 Jessica – Vui tươi, Ấm áp (Nữ)'), ('FGY2WhTYpPnrIDTdsKH5', '🆓 Laura – Nhiệt tình, Năng động (Nữ)'), ('XrExE9yKIg1WjnnlVkGX', '🆓 Matilda – Hiểu biết, Chuyên nghiệp (Nữ)'), ('CwhRBWXzGAHq8TQ4Fs17', '🆓 Roger – Thư giãn, Trầm vang (Nam)'), ('nPczCjzI2devNBz1zQrb', '🆓 Brian – Sâu lắng, Ấm áp (Nam)'), ('onwK4e9ZLuTAKqWW03F9', '🆓 Daniel – Phát thanh viên (Nam, Anh)'), ('pNInz6obpgDQGcFmaJgB', '🆓 Adam – Mạnh mẽ, Dứt khoát (Nam)'), ('JBFqnCBsd6RMkjVDRZzb', '🆓 George – Kể chuyện, Cuốn hút (Nam, Anh)'), ('TX3LPaxmHKxFdv7VOQHJ', '🆓 Liam – Năng lượng, Social Media (Nam)'), ('iP95p4xoKVk53GoZ742B', '🆓 Chris – Quyến rũ, Gần gũi (Nam)'), ('cjVigY5qzO86Huf0OWal', '🆓 Eric – Mượt mà, Đáng tin cậy (Nam)'), ('bIHbv24MWmeRgasZH58o', '🆓 Will – Lạc quan, Thư giãn (Nam)'), ('IKne3meq5aSn9XLyUdCD', '🆓 Charlie – Trầm, Tự tin (Nam, Úc)'), ('N2lVS1w4EtoT3dr4eOWO', '🆓 Callum – Khàn, Tinh quái (Nam)'), ('SOYHLrjzK2X1ezoPC6cr', '🆓 Harry – Mãnh liệt, Chiến binh (Nam)'), ('pqHfZKP75CvOlQylNhV4', '🆓 Bill – Khôn ngoan, Trầm tĩnh (Nam)'), ('SAz9YHcvj6GT2YYXdXww', '🆓 River – Trung tính, Thông tin'), ('jydR2VHYWfW6Yi35URqJ', '💎VIP William – Formal, Measured (Nam, VN)'), ('VkftF4RyfVI5yIYa6wFa', '💎VIP Huy Bùi – Firm, Calm (Nam, VN)'), ('BUPPIXeDaJWBz696iXRS', '💎VIP Dũng – Poetic, Deep (Nam, VN)'), ('JYT6xPLD3LGl0ui3YXNq', '💎VIP Khanh – Dynamic, Conversational (Nam, VN)'), ('7XOKiK112QRZRSLbCfMc', '💎VIP Liam – Warm, Thoughtful (Nam, VN)'), ('3VnrjnYrskPMDsapTr8X', '💎VIP Tung Dang – Deep, Warm (Nam, VN)'), ('M0rVwr32hdQ5UXpkI3ni', '💎VIP Hao – Warm, Gentle Narrator (Nam, VN)'), ('wvL4QjDMWwrrTQuXUYlw', '💎VIP Simon – Strong, Clear (Nam, VN)'), ('KkZEqzG4FfkIHMbzFAnu', '💎VIP Nam – Clear, Firm (Nam, VN)'), ('faGOoglJYMOx2d1ya5l9', '💎VIP Xuan – Energetic, Motivational (Nam, VN)'), ('BlZK9tHPU6XXjwOSIiYA', '💎VIP Trang – Clear, Smooth (Nữ, VN)'), ('DXiwi9uoxet6zAiZXynP', '💎VIP Hung Tran – Deep, Calm (Nam, VN)'), ('FTYCiQT21H9XQvhRu0ch', '💎VIP Trung – Soft, Smooth (Nam, VN)'), ('7WNWm0yUcEolHsfg5Bhk', '💎VIP Sang Truong – Deep, Resonant (Nam, VN)'), ('5GqeT84PUduicivx0y5x', '💎VIP Thang – Clear, Firm (Nam, VN)'), ('LPldyaIkUUSOPCRFrgYJ', '💎VIP Hùng – Steady, Serious (Nam, VN)'), ('i5pAdlAfmoAYKmD5vJu5', '💎VIP Phong – Formal, Steady (Nam, VN)'), ('sbaSITtJLv4yb3vIi67Z', '💎VIP Nam – Calm, Warm Actor (Nam, VN)'), ('pGapy9MNHCukzJtjavF0', '💎VIP Hạnh – Smooth, Clear (Nữ, VN)'), ('1l0C0QA9c9jN22EmWiB0', '💎VIP Jade – Clear, Natural (Nữ, VN)'), ('NSzi72jFi7P1JqCwPRuM', '💎VIP Henry – Clear, Firm MC (Nam, VN)'), ('XBDAUT8ybuJTTCoOLSUj', '💎VIP Đức – Clear, Calm MC (Nam, VN)'), ('WVkYyTxxVgMOsw1IIVL0', '💎VIP Hieu Tran – Deep, Warm (Nam, VN)'), ('JxmKvRaNYFidf0N27Vng', '💎VIP Son Tran – Casual, Conversational (Nam, VN)'), ('1d5Bb0SMBPB10Gx6iQeu', '💎VIP Tung Dang – Warm, Calm (Nam, VN)'), ('xPEfmymXC4WdBxGMznS7', '💎VIP Tuyết – Crisp, Formal (Nữ, VN)'), ('zIusdI28yOZPwIBus0aI', '💎VIP Ân – Casual, Bubbly (Nữ, VN)'), ('SV45Oxy7wx09dotPbEsL', '💎VIP Kim – Vibrant, Friendly (Nữ, VN)'), ('mJLZ5p8I7Pk81BHpKwbx', '💎VIP Nam Sadoma – Warm, Professional (Nam, VN)'), ('foH7s9fX31wFFH2yqrFa', '💎VIP Huyen – Calm, Friendly (Nữ, VN)'), ('Na53UVgcmbKZaZMsp5JE', '💎VIP Linh – Calm, Gentle (Nữ, VN)'), ('M1eOJnaNVAbMVhDoXfRb', '💎VIP Hung Pham – Deep, Professional (Nam, VN)'), ('618Y3IAxt3co9hC3Dbsa', '💎VIP Phuc – Calm, Formal (Nam, VN)'), ('9EE00wK5qV6tPtpQIxvy', '💎VIP Tuan – Friendly, Calm (Nam, VN)'), ('mMa5ygDNluQLD1EaTZLI', '💎VIP Tuyến – Formal, Serious (Nữ, VN)'), ('qp0lBtq2TxYPepHSR0D1', '💎VIP Minh – Clear, Firm Narrator (Nam, VN)'), ('2wMoasbnkroyeaj9FYxI', '💎VIP Dao – Reflective, Emotional (Nữ, VN)'), ('7hsfEc7irDn6E8br0qfw', '💎VIP Hai Ly – Deep, Serious (Nam, VN)'), ('Zm5fDdtChmOUe69OSYwx', '💎VIP Sơn – Warm, Soft (Nam, VN)'), ('HAAKLJlaJeGl18MKHYeg', '💎VIP Trang – Soft, Whispery (Nữ, VN)'), ('jpmnSYDOADVEpZksbLmc', '💎VIP Nhung – Clear, Formal (Nữ, VN)'), ('ueSxRO0nLF1bj93J2hVt', '💎VIP Trung Caha – Clear, Firm (Nam, VN)'), ('2vT8WlUXV1qBtgiLZdSb', '💎VIP Mai – Warm, Formal (Nữ, VN)'), ('yvKg3CwzCYDTwyHnWQLg', '💎VIP Steve – Calm, Expressive (Nam, VN)'), ('qA5SHJ9UjGlW2QwXWR7w', '💎VIP Joe – Confident (Nam, VN)'), ('SWu2lWaUX4JBPKyh7h1p', '💎VIP Dembo Jang – Clear (Nam, Hàn)'), ('BbsagRO6ohd8MKPS2Ob0', '💎VIP Jin Geon Song – Neutral, Calm (Nam, Hàn)'), ('xATBIQpnuBjCSYjoQx80', '💎VIP Nathan – Empathetic (Nam, Hàn)'), ('YBRudLRm83BV5Mazcr42', '💎VIP Jason – Meditative, Calm (Nam, Hàn)'), ('ksaI0TCD9BstzEzlxj4q', '💎VIP Seulki – Inviting, Calm (Nữ, Hàn)'), ('K3qo7ugXmpT87FDhLBbN', '💎VIP Gale – Inviting, Natural (Nam, Hàn)'), ('v1jVu1Ky28piIPEJqRrm', '💎VIP David – Warm, Measured (Nam, Hàn)'), ('PLfpgtLkFW07fDYbUiRJ', '💎VIP Bongpal – Cheerful, Clear (Nam, Hàn)'), ('uyVNoMrnUku1dZyVEXwD', '💎VIP Anna Kim – Tender, Calm (Nữ, Hàn)'), ('s07IwTCOrCDCaETjUVjx', '💎VIP Hyunbin – Diplomatic, Clear (Nam, Hàn)'), ('JOcmGzB8OFjY8MhjHHEf', '💎VIP Jun – Calm, Clear, Husky (Nam, Nhật)'), ('4E2rGmyoHYBHfdVr32pj', '💎VIP Toshi – Neutral, Steady (Nam, Nhật)'), ('A4AyGcPAjb1pHgflyZZp', '💎VIP Ritsuto – Anime Prince (Nam, Nhật)'), ('ss9cJxDAEMXP4wfQ3GPr', '💎VIP Daisuke – Serious, Balanced (Nam, Nhật)'), ('Raa94hHxcH2itBN60mKp', '💎VIP Mei – Friendly, Clear (Nữ, Nhật)'), ('G3EZ8O36A0x9lmeOtr0f', '💎VIP Kaori – Relatable, Friendly (Nữ, Nhật)'), ('WQz3clzUdMqvBf0jswZQ', '💎VIP Shizuka – Natural, Soft (Nữ, Nhật)'), ('B8gJV1IhpuegLxdpXFOE', '💎VIP Kuon – Cheerful, Clear (Nữ, Nhật)'), ('oYuK6X6xL9cwJKfgStee', '💎VIP Markus – Documentary (Nam, Trung)'), ('NwTfmofvvKEZRJsUayUt', '💎VIP Lavish – Bold, Engaging (Nam, Trung)'), ('kqVT88a5QfII1HNAEPTJ', '💎VIP Declan Sage – Wise (Nam, Trung)'), ('1cxc5c3E9K6F1wlqOJGV', '💎VIP Emily – Gentle, Soft (Nữ, Trung)'), ('rCYFsCX2waxtHCgVD0e8', '💎VIP Matthew – Wicked Demon (Nam, Trung)'), ('20zUtLxCwVzsFDWub4sB', '💎VIP Stefanos – Calm, Narrational (Nam, Trung)'), ('OYWwCdDHouzDwiZJWOOu', '💎VIP David – Gruff Cowboy (Nam, Trung)'), ('jtE6dbPUTt2kchN89Uej', '💎VIP James – Deep, Raspy (Nam, Trung)'), ('RKCbSROXui75bk1SVpy8', '💎VIP Shaun – British, Clean (Nam, Trung)'), ('4O1sYUnmtThcBoSBrri7', '💎VIP Maya – Friendly, Cheerful (Nữ, Trung)')]
_PREMADE_IDS = {'nPczCjzI2devNBz1zQrb', 'iP95p4xoKVk53GoZ742B', 'pqHfZKP75CvOlQylNhV4', 'EXAVITQu4vr4xnSDxMaL', 'onwK4e9ZLuTAKqWW03F9', 'cgSgspJ2msm6clMCkdW9', 'pNInz6obpgDQGcFmaJgB', 'SAz9YHcvj6GT2YYXdXww', 'pFZP5JQG7iQjIQuC4Bku', 'SOYHLrjzK2X1ezoPC6cr', 'N2lVS1w4EtoT3dr4eOWO', 'TX3LPaxmHKxFdv7VOQHJ', 'FGY2WhTYpPnrIDTdsKH5', 'hpp4J3VqNfWAUOO0d1Us', 'JBFqnCBsd6RMkjVDRZzb', 'XrExE9yKIg1WjnnlVkGX', 'cjVigY5qzO86Huf0OWal', 'bIHbv24MWmeRgasZH58o', 'IKne3meq5aSn9XLyUdCD', 'Xb7hH8MSUJpSbSDYk0k2', 'CwhRBWXzGAHq8TQ4Fs17'}
ELEVENLABS_VOICE_META = {'EXAVITQu4vr4xnSDxMaL': ('female', f'{_P}/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2216a32186.mp3'), 'hpp4J3VqNfWAUOO0d1Us': ('female', f'{_P}/hpp4J3VqNfWAUOO0d1Us/dab0f5ba-3aa4-48a8-9fad-f138fea1126d.mp3'), 'pFZP5JQG7iQjIQuC4Bku': ('female', f'{_P}/pFZP5JQG7iQjIQuC4Bku/89b68b35-b3dd-4348-a84a-a3c13a3c2b30.mp3'), 'Xb7hH8MSUJpSbSDYk0k2': ('female', f'{_P}/Xb7hH8MSUJpSbSDYk0k2/d10f7534-11f6-41fe-a012-2de1e482d336.mp3'), 'cgSgspJ2msm6clMCkdW9': ('female', f'{_P}/cgSgspJ2msm6clMCkdW9/56a97bf8-b69b-448f-846c-c3a11683d45a.mp3'), 'FGY2WhTYpPnrIDTdsKH5': ('female', f'{_P}/FGY2WhTYpPnrIDTdsKH5/67341759-ad08-41a5-be6e-de12fe448618.mp3'), 'XrExE9yKIg1WjnnlVkGX': ('female', f'{_P}/XrExE9yKIg1WjnnlVkGX/b930e18d-6b4d-466e-bab2-0ae97c6d8535.mp3'), 'CwhRBWXzGAHq8TQ4Fs17': ('male', f'{_P}/CwhRBWXzGAHq8TQ4Fs17/58ee3ff5-f6f2-4628-93b8-e38eb31806b0.mp3'), 'nPczCjzI2devNBz1zQrb': ('male', f'{_P}/nPczCjzI2devNBz1zQrb/2dd3e72c-4fd3-42f1-93ea-abc5d4e5aa1d.mp3'), 'onwK4e9ZLuTAKqWW03F9': ('male', f'{_P}/onwK4e9ZLuTAKqWW03F9/7eee0236-1a72-4b86-b303-5dcadc007ba9.mp3'), 'pNInz6obpgDQGcFmaJgB': ('male', f'{_P}/pNInz6obpgDQGcFmaJgB/d6905d7a-dd26-4187-bfff-1bd3a5ea7cac.mp3'), 'JBFqnCBsd6RMkjVDRZzb': ('male', f'{_P}/JBFqnCBsd6RMkjVDRZzb/e6206d1a-0721-4787-aafb-06a6e705cac5.mp3'), 'TX3LPaxmHKxFdv7VOQHJ': ('male', f'{_P}/TX3LPaxmHKxFdv7VOQHJ/63148076-6363-42db-aea8-31424308b92c.mp3'), 'iP95p4xoKVk53GoZ742B': ('male', f'{_P}/iP95p4xoKVk53GoZ742B/3f4bde72-cc48-40dd-829f-57fbf906f4d7.mp3'), 'cjVigY5qzO86Huf0OWal': ('male', f'{_P}/cjVigY5qzO86Huf0OWal/d098fda0-6456-4030-b3d8-63aa048c9070.mp3'), 'bIHbv24MWmeRgasZH58o': ('male', f'{_P}/bIHbv24MWmeRgasZH58o/8caf8f3d-ad29-4980-af41-53f20c72d7a4.mp3'), 'IKne3meq5aSn9XLyUdCD': ('male', f'{_P}/IKne3meq5aSn9XLyUdCD/102de6f2-22ed-43e0-a1f1-111fa75c5481.mp3'), **{'N2lVS1w4EtoT3dr4eOWO': ('male', f'{_P}/N2lVS1w4EtoT3dr4eOWO/ac833bd8-ffda-4938-9ebc-b0f99ca25481.mp3'), 'SOYHLrjzK2X1ezoPC6cr': ('male', f'{_P}/SOYHLrjzK2X1ezoPC6cr/86d178f6-f4b6-4e0e-85be-3de19f490794.mp3'), 'pqHfZKP75CvOlQylNhV4': ('male', f'{_P}/pqHfZKP75CvOlQylNhV4/d782b3ff-84ba-4029-848c-acf01285524d.mp3'), 'SAz9YHcvj6GT2YYXdXww': ('neutral', f'{_P}/SAz9YHcvj6GT2YYXdXww/e6c95f0b-2227-491a-b3d7-2249240decb7.mp3'), 'jydR2VHYWfW6Yi35URqJ': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/48564e86fda1402c9cd1f56e52b97a15/voices/jydR2VHYWfW6Yi35URqJ/7bdd9ae9-526f-4f94-b879-a8317092c090.mp3'), 'VkftF4RyfVI5yIYa6wFa': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/ca6cbcacc74c4e88894e7e07f37a054d/voices/VkftF4RyfVI5yIYa6wFa/f08690de-7f58-4eda-90e5-4cb4f421b2ef.mp3'), 'BUPPIXeDaJWBz696iXRS': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/1c87abbb500842198db0abe24e2cd4c5/voices/BUPPIXeDaJWBz696iXRS/0d5e5718-e604-4df0-9639-f58cb86784d1.mp3'), 'JYT6xPLD3LGl0ui3YXNq': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/04fb3945fa104e338d062160ad79536d/voices/JYT6xPLD3LGl0ui3YXNq/e28d3c2a-079a-4f83-b8e6-ae0e8c326530.mp3'), '7XOKiK112QRZRSLbCfMc': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/57cf4c11860945609dd35496550aef37/voices/7XOKiK112QRZRSLbCfMc/c98864dc-4616-4cf6-9119-b51a357680ae.mp3'), '3VnrjnYrskPMDsapTr8X': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/62afa812c5e94cf79a31f6052251579e/voices/3VnrjnYrskPMDsapTr8X/rTtnskqz8S0pmuxMwNB3.mp3'), 'M0rVwr32hdQ5UXpkI3ni': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/user/vPhRu1PHR7TqGFJZ4bBlH9BiTmO2/voices/M0rVwr32hdQ5UXpkI3ni/TdQYzBzvE2L4Kns4yzi4.mp3'), 'wvL4QjDMWwrrTQuXUYlw': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/user/6Zt1ZPZThsOMUasUigILNIvJK9q2/voices/wvL4QjDMWwrrTQuXUYlw/9e21e9bc-5c29-43e9-a7f6-3c234b1acfa5.mp3'), 'KkZEqzG4FfkIHMbzFAnu': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/53661fdabc81431eb0ec0723bf2996cd/voices/KkZEqzG4FfkIHMbzFAnu/e89f4b63-114a-4abd-a1ca-8213f9ae3cbc.mp3'), 'faGOoglJYMOx2d1ya5l9': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/92f7416e9e6c4f11b98f960bc08ca7f6/voices/faGOoglJYMOx2d1ya5l9/f41cb339-fac4-47c0-89c1-51ba1341cec0.mp3'), 'BlZK9tHPU6XXjwOSIiYA': ('female', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/bab57ef07233478a8754de0ac4be4f82/voices/BlZK9tHPU6XXjwOSIiYA/4847d94c-dc44-42db-ad21-fba7bb80f4ac.mp3'), 'DXiwi9uoxet6zAiZXynP': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/1b14e8f51499451db4f0896a923c1f73/voices/DXiwi9uoxet6zAiZXynP/ZXEyuqQ2pfxLEM30hsbr.mp3'), 'FTYCiQT21H9XQvhRu0ch': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/bd0adfaacf8a4177a263adba6efd911a/voices/FTYCiQT21H9XQvhRu0ch/efc9a24c-917d-49cb-a2ad-e2d28d121776.mp3')}, **{'7WNWm0yUcEolHsfg5Bhk': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/d0696db4306b49248947ecd6ddbc2f42/voices/7WNWm0yUcEolHsfg5Bhk/75d5ce3c-175e-4479-a0e9-e0cd7d841745.mp3'), '5GqeT84PUduicivx0y5x': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/14fc612981814e6aac3fdf8a45e3ec7d/voices/5GqeT84PUduicivx0y5x/887d8f30-2cb6-4a22-8521-3b0c61748285.mp3'), 'LPldyaIkUUSOPCRFrgYJ': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/1be3841cfd19496eb4ac680bb0f3e197/voices/LPldyaIkUUSOPCRFrgYJ/96a4a622-f41f-48d6-af9e-72337522bb9b.mp3'), 'i5pAdlAfmoAYKmD5vJu5': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/a9984bce6ee84629bc903a395b81594f/voices/i5pAdlAfmoAYKmD5vJu5/TgP5xkqvxs5YKcPSkM3a.mp3'), 'sbaSITtJLv4yb3vIi67Z': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/bb916edac72a42169157c694d0eba717/voices/sbaSITtJLv4yb3vIi67Z/VfaiEckVm0oK3fYyWyrQ.mp3'), 'pGapy9MNHCukzJtjavF0': ('female', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/86fa75d668664d05b672422c46445ee1/voices/pGapy9MNHCukzJtjavF0/duQY8YxBOH1Nje7wdDiR.mp3'), '1l0C0QA9c9jN22EmWiB0': ('female', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/1e1bb97afeab43e996ceefadc09fce07/voices/1l0C0QA9c9jN22EmWiB0/vFO3lx21S99x88TEecy5.mp3'), 'NSzi72jFi7P1JqCwPRuM': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/user/luAlPmY2SjaETAJembza6ctDyIY2/voices/NSzi72jFi7P1JqCwPRuM/eRa8JPGgbqQs4gPdXuv6.mp3'), 'XBDAUT8ybuJTTCoOLSUj': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/user/Gt3WUmSM8Dfv53wkfk785cWUf4a2/voices/XBDAUT8ybuJTTCoOLSUj/NyApKgQVL7sSD5vQLGJl.mp3'), 'WVkYyTxxVgMOsw1IIVL0': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/2855cfd00521439d9e218d30f34fa2e8/voices/WVkYyTxxVgMOsw1IIVL0/b9cb80e5-89f1-4230-be86-42a35c8aa9a4.mp3'), 'JxmKvRaNYFidf0N27Vng': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/user/OymriXbgJoQbrYAIuB2fEDlSAqN2/voices/JxmKvRaNYFidf0N27Vng/Z9ia8B08GeSQQaW6SGSu.mp3'), '1d5Bb0SMBPB10Gx6iQeu': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/24db693bcec14a73b52ba05a2c68b4f1/voices/1d5Bb0SMBPB10Gx6iQeu/4fa59491-5277-44eb-9cba-8338034d77b0.mp3'), 'xPEfmymXC4WdBxGMznS7': ('female', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/9d8c3e6f2a2d4f0785dbce6e39838c85/voices/xPEfmymXC4WdBxGMznS7/xuq5fw3fKBo80gn9Ac5e.mp3'), 'zIusdI28yOZPwIBus0aI': ('female', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/9a9670f987f94ad0be183c9a84668d35/voices/zIusdI28yOZPwIBus0aI/ctAn5c5p35e6Zig8gzw7.mp3'), 'SV45Oxy7wx09dotPbEsL': ('female', 'https://storage.googleapis.com/eleven-public-prod/database/user/aebtjiDGQsYbSlwW9Va7dA5CmfC2/voices/SV45Oxy7wx09dotPbEsL/Q0a7NP0uI98LY1qP0zTY.mp3'), 'mJLZ5p8I7Pk81BHpKwbx': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/user/0B9Gy9XsGPcNDeaxCHuHPhEbeq23/voices/mJLZ5p8I7Pk81BHpKwbx/182afc0c-622b-449c-99e0-1e8a6f689dc1.mp3'), 'foH7s9fX31wFFH2yqrFa': ('female', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/1e1bb97afeab43e996ceefadc09fce07/voices/foH7s9fX31wFFH2yqrFa/XEIsoRs7xArbmUx1pJpp.mp3')}, **{'Na53UVgcmbKZaZMsp5JE': ('female', 'https://storage.googleapis.com/eleven-public-prod/database/user/vy5yH2PaY5Vjkf70eDZzX09NvB12/voices/Na53UVgcmbKZaZMsp5JE/4cfb85d5-4601-49e9-b6d0-2762f5743495.mp3'), 'M1eOJnaNVAbMVhDoXfRb': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/bbf78ebf9b724da896d7bf9dfeba9e3c/voices/M1eOJnaNVAbMVhDoXfRb/K2qzekZ5iJAwykvWJf20.mp3'), '618Y3IAxt3co9hC3Dbsa': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/700f80689f104f01b58e65bf0e77a2d6/voices/618Y3IAxt3co9hC3Dbsa/hEGZ14QOgGCUR05wvWhv.mp3'), '9EE00wK5qV6tPtpQIxvy': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/b3deb46ca59d44d4bce00f6b113182c2/voices/9EE00wK5qV6tPtpQIxvy/dcd40a37-bd29-4e24-b4b1-70a045e79467.mp3'), 'mMa5ygDNluQLD1EaTZLI': ('female', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/e219759cc10548e8b65b8dbf3fd68475/voices/mMa5ygDNluQLD1EaTZLI/RntBCIcoAIrNYBYJAz9N.mp3'), 'qp0lBtq2TxYPepHSR0D1': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/d64965a616e04eb3b1154b15de8bc991/voices/qp0lBtq2TxYPepHSR0D1/bRbmTZVy1pY7511nv1rZ.mp3'), '2wMoasbnkroyeaj9FYxI': ('female', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/9a9670f987f94ad0be183c9a84668d35/voices/2wMoasbnkroyeaj9FYxI/o1e2pKHZuTZSxwTk5B6d.mp3'), '7hsfEc7irDn6E8br0qfw': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/84b9319ecc3146cea264172a94f7933b/voices/7hsfEc7irDn6E8br0qfw/93dcf970-15c9-4d5d-9a0e-0922217412f6.mp3'), 'Zm5fDdtChmOUe69OSYwx': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/16e6eb03381a4480932d149d77e6568d/voices/Zm5fDdtChmOUe69OSYwx/s2zC9VyzB8mFzu8SSh4u.mp3'), 'HAAKLJlaJeGl18MKHYeg': ('female', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/9d8c3e6f2a2d4f0785dbce6e39838c85/voices/HAAKLJlaJeGl18MKHYeg/zD0vyJoLQimI2pdR9IDK.mp3'), 'jpmnSYDOADVEpZksbLmc': ('female', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/4373ad99435f481484eca085dbc17111/voices/jpmnSYDOADVEpZksbLmc/cQFGuQ32d6iC2g6OYQMk.mp3'), 'ueSxRO0nLF1bj93J2hVt': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/7d170bfe747245f0a4b7a5659036a696/voices/ueSxRO0nLF1bj93J2hVt/de4ac6e9-75d7-44c5-bb50-2305dfdda280.mp3'), '2vT8WlUXV1qBtgiLZdSb': ('female', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/bdd054c9005849c482203e064fd6035f/voices/2vT8WlUXV1qBtgiLZdSb/LGmdgLp1pXX199g9qHjm.mp3'), 'yvKg3CwzCYDTwyHnWQLg': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/4cef60ae9d524976a730b38fe1bb3361/voices/yvKg3CwzCYDTwyHnWQLg/Kyz2CqTyAxouEtOFX00x.mp3'), 'qA5SHJ9UjGlW2QwXWR7w': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/b2109416c7514449a5f06540d10f0e73/voices/qA5SHJ9UjGlW2QwXWR7w/omNXT757fjXIfKPQrTSp.mp3'), 'SWu2lWaUX4JBPKyh7h1p': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/731a7e76530f4ebeaeaf2c5cce069f9e/voices/SWu2lWaUX4JBPKyh7h1p/25e4bdb7-3c71-498f-9350-42b37cbda60e.mp3'), 'BbsagRO6ohd8MKPS2Ob0': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/9ffd2a2bdf3240f6b78a9cb009cc346b/voices/BbsagRO6ohd8MKPS2Ob0/sHiGQcmygSSDVUTzuKjA.mp3')}, **{'xATBIQpnuBjCSYjoQx80': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/313bf98670f543989ea81fc7cd45c132/voices/xATBIQpnuBjCSYjoQx80/c7f167eb-3bd2-49d7-888b-03394132627a.mp3'), 'YBRudLRm83BV5Mazcr42': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/c88a0f15f1c940049e493feb6a659b55/voices/YBRudLRm83BV5Mazcr42/e5S1lbdQIHQ59tQyonW8.mp3'), 'ksaI0TCD9BstzEzlxj4q': ('female', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/b10a4abd897343c8aa80ff543b86b7ce/voices/ksaI0TCD9BstzEzlxj4q/bizji0eQlVSfyOy39GQ7.mp3'), 'K3qo7ugXmpT87FDhLBbN': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/bc9c4ea00e72479fa519624c038eab8d/voices/K3qo7ugXmpT87FDhLBbN/hD2UxI6JZf7pItjBpo3z.mp3'), 'v1jVu1Ky28piIPEJqRrm': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/8d600bafbd274a48a03b1e1ca0fee1ff/voices/v1jVu1Ky28piIPEJqRrm/P7A6ENIaIXKp1Vfd5N0L.mp3'), 'PLfpgtLkFW07fDYbUiRJ': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/57d5da017adf44a587be0e6741a5245b/voices/PLfpgtLkFW07fDYbUiRJ/b270ecf9-a56d-44c3-b3a8-65b1b5caebdb.mp3'), 'uyVNoMrnUku1dZyVEXwD': ('female', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/8825b237e92b4c0c9abf122b9d4a8894/voices/uyVNoMrnUku1dZyVEXwD/W55oP1IsLNaNaglJpUZd.mp3'), 's07IwTCOrCDCaETjUVjx': ('male', 'https://storage.googleapis.com/eleven-public-prod/hSWXaUomcSNh92DBdVimNedwBFB2/voices/s07IwTCOrCDCaETjUVjx/b9065609-ce5d-409b-b42d-59a39962f088.mp3'), 'JOcmGzB8OFjY8MhjHHEf': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/f54d7763990d40b9b2fc90c9ee2a999a/voices/JOcmGzB8OFjY8MhjHHEf/9724480d-31e2-49a4-8562-18ea36baed5c.mp3'), '4E2rGmyoHYBHfdVr32pj': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/9e11428dfda94e6e8050f738fdcc3b5c/voices/4E2rGmyoHYBHfdVr32pj/a4ae3f19-730d-4b71-b4e8-9c3183da700e.mp3'), 'A4AyGcPAjb1pHgflyZZp': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/cda515cc56d4408fbffd3f464fc33f4f/voices/A4AyGcPAjb1pHgflyZZp/zPyavZ343C9OzHfYXsLP.mp3'), 'ss9cJxDAEMXP4wfQ3GPr': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/e265fb540647402bb8c9cfad5204ed47/voices/ss9cJxDAEMXP4wfQ3GPr/ae1cd452-8165-4699-871b-d3941cfc121c.mp3'), 'Raa94hHxcH2itBN60mKp': ('female', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/ee988692cc0b4bebb1d18c93e85f41db/voices/Raa94hHxcH2itBN60mKp/keT7Z6DY3f4eBteVam1K.mp3'), 'G3EZ8O36A0x9lmeOtr0f': ('female', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/ed9b05e6324c457685490352e9a1ec90/voices/G3EZ8O36A0x9lmeOtr0f/WwxHXLTkGGjWoXJIsCWr.mp3'), 'WQz3clzUdMqvBf0jswZQ': ('female', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/8d4b2297d90b4dafb1b6c97b0791083f/voices/WQz3clzUdMqvBf0jswZQ/i6AmEdWw199PgEgmzXn0.mp3'), 'B8gJV1IhpuegLxdpXFOE': ('female', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/cda515cc56d4408fbffd3f464fc33f4f/voices/B8gJV1IhpuegLxdpXFOE/38bca842-43a2-4be7-9fbd-0097cca97d45.mp3'), 'oYuK6X6xL9cwJKfgStee': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/631bf5a20c2d45ffacc1311eb5dec41f/voices/oYuK6X6xL9cwJKfgStee/nBQ2mkMk4ldkmqcnyoxT.mp3')}, **{'NwTfmofvvKEZRJsUayUt': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/ed9b05e6324c457685490352e9a1ec90/voices/NwTfmofvvKEZRJsUayUt/KwSXXmVhgfKyAyhALQEA.mp3'), 'kqVT88a5QfII1HNAEPTJ': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/5d6438deeb7d443ca0a6fc6309d5bb8a/voices/kqVT88a5QfII1HNAEPTJ/Hex3MZnpQ3dCbdgTkKyr.mp3'), '1cxc5c3E9K6F1wlqOJGV': ('female', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/94137f75d3954f2f8ebb452cb583bb52/voices/1cxc5c3E9K6F1wlqOJGV/HPC2o7hJfzll0uTxjsVl.mp3'), 'rCYFsCX2waxtHCgVD0e8': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/d309ea25683d4d97b92e44772a430c74/voices/rCYFsCX2waxtHCgVD0e8/jrrjTeRLNK6WyxAaEAhO.mp3'), '20zUtLxCwVzsFDWub4sB': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/255baaabcfc84b5eb4f04d692be78392/voices/20zUtLxCwVzsFDWub4sB/CcN2gbQ6PDzvLXrOjPjp.mp3'), 'OYWwCdDHouzDwiZJWOOu': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/ba117b7c1ee74678b9bd31dcc09e8a54/voices/OYWwCdDHouzDwiZJWOOu/H26wJOBAAcT6rE0s7kHA.mp3'), 'jtE6dbPUTt2kchN89Uej': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/e411ad79f9344e8c8b8f3beede37e82d/voices/jtE6dbPUTt2kchN89Uej/ChsqMv4EQTMVvaEoKZJq.mp3'), 'RKCbSROXui75bk1SVpy8': ('male', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/c9a26cec4bc849c3b3a98f85e0a405e9/voices/RKCbSROXui75bk1SVpy8/elhzu4vnu2pcZO29nzng.mp3'), '4O1sYUnmtThcBoSBrri7': ('female', 'https://storage.googleapis.com/eleven-public-prod/database/workspace/514d94e9241c48e8b7905375729c436f/voices/4O1sYUnmtThcBoSBrri7/H62OViSeqwMim7rCIDvv.mp3')}}
ELEVENLABS_VOICE_META: 'dict[str, tuple[str, str]]'

def _parse_keys(raw: str) -> list[str]:
    import re
    if raw and str(raw).strip():
        parts = re.split('[|\\n;,]+', str(raw))
        keys = []
        seen = set()
        for part in parts:
            key = part.strip()
            if key and key not in seen and (key.startswith('sk_') or len(key) >= 20):
                seen.add(key)
                keys.append(key)
        return keys
    return []

class _KeyRotator:
    __doc__ = 'Thread-safe xoay vòng nhiều API key, skip key bị 429.'

    def __init__(self, keys: list[str]):
        self._keys = list(keys) if keys else []
        self._idx = 0
        self._lock = threading.Lock()
        self._exhausted = set()

    def get(self) -> str:
        with self._lock:
            if self._keys:
                for _ in range(len(self._keys)):
                    if self._idx not in self._exhausted:
                        return
                    self._idx = (self._idx + 1) % len(self._keys)
                self._exhausted.clear()
                return self._keys[self._idx]
            return ''

    def mark_exhausted(self, key: str):
        with self._lock:
            for i, k in enumerate(self._keys):
                if k == key:
                    self._exhausted.add(i)
            for _ in range(len(self._keys)):
                self._idx = (self._idx + 1) % len(self._keys)
                if self._idx in self._exhausted:
                    pass

    @property
    def count(self) -> int:
        return len(self._keys)

class ElevenLabsTTSEngine:
    __doc__ = '\nTạo speech bằng ElevenLabs API (online, có gói free).\nHỗ trợ multi-key: truyền nhiều key ngăn bằng | hoặc newline → tự xoay\nkhi key bị 429 (hết quota).\n'
    _BASE_URL = 'https://api.elevenlabs.io/v1/text-to-speech'

    def __init__(self, api_key: str, voice: str='EXAVITQu4vr4xnSDxMaL', speed: float=1.0, proxy: str='', relay_url: str='', relay_secret: str=''):
        self.voice = voice
        self.speed = speed
        self._relay_url = relay_url.rstrip('/') if relay_url else ''
        self._relay_secret = relay_secret.strip() if relay_secret else ''
        keys = _parse_keys(api_key)
        if keys or self._relay_url:
            self._rotator = _KeyRotator(keys) if keys else None
            self._proxies = None
            if proxy:
                proxy = proxy.strip()
                parts = proxy.split('://', 1)
                scheme, rest = (((parts[0] + '://', parts[1]) if len(parts) == 2 else ('', parts[0]))[0], ((parts[0] + '://', parts[1]) if len(parts) == 2 else ('', parts[0]))[1])
                segs = rest.split(':')
                if len(segs) == 4:
                    ip, port, user, pwd = (segs[0], segs[1], segs[2], segs[3])
                    proxy = f"{scheme or 'http://'}" + f'{user}:{pwd}@{ip}:{port}'
                elif not scheme:
                    proxy = 'http://' + proxy
                self._proxies = {'http': proxy, 'https': proxy}
                return None
        else:
            raise ValueError('ElevenLabs API Key không được để trống!\nLấy tại: elevenlabs.io → Profile → API Keys')

    def generate(self, text: str, output_path: str, progress_cb: Callable[[str], None] | None=None) -> str:
        import requests
        if self._rotator and self._rotator._keys:
            try:
                pass
            except RuntimeError as e:
                _msg = str(e)
                if 'Hết quota' not in _msg and 'hết quota' not in _msg.lower():
                    raise
        elif self._relay_url:
            _tried = set()
            for _ in range(12):
                relay_key = self._fetch_el_relay_key()
                if relay_key and relay_key not in _tried:
                    _tried.add(relay_key)
                    try:
                        if progress_cb:
                            progress_cb(f'🔑 Key relay ..{relay_key[-4:]}, gọi trực tiếp...')
                        return self._generate_direct_with_key(text, output_path, relay_key, progress_cb)
                    except RuntimeError as e:
                        _m = str(e)
                        if 'HTTP 402' in _m:
                            raise RuntimeError('❌ Giọng đọc này cần key trả phí!\nGiọng community (VN/Hàn/Nhật/Trung) cần key trả phí.\nDùng giọng Premade (21 giọng đầu danh sách) với pool free.')
                        if 'HTTP 422' in _m:
                            raise
            if self._relay_url:
                try:
                    pass
                except Exception:
                    pass
            else:
                raise RuntimeError('❌ Hết quota tất cả ElevenLabs key!\nBundled keys hết + Relay cũng hết.\nChờ reset hoặc thêm key mới.')

    def _fetch_el_relay_key(self) -> str:
        import requests
        try:
            url = f'{self._relay_url}/el/key'
            headers = {}
            if self._relay_secret:
                headers['X-Relay-Secret'] = self._relay_secret
            try:
                from auth_session import get_relay_auth_headers
                headers.update(get_relay_auth_headers())
            except Exception:
                pass
            if not headers.get('Authorization'):
                try:
                    from utils_license import load_saved_license
                    _vtp = load_saved_license() or ''
                    if _vtp:
                        headers['X-VTP-Key'] = _vtp
                except Exception:
                    pass
            resp = requests.post(url, json={}, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
            else:
                return ''
        except Exception:
            return ''

    def _generate_direct_with_key(self, text: str, output_path: str, api_key: str, progress_cb: Callable[[str], None] | None) -> str:
        import requests
        url = f'{self._BASE_URL}/{self.voice}'
        payload = {'text': text, 'model_id': 'eleven_multilingual_v2', 'voice_settings': {'stability': 0.5, 'similarity_boost': 0.75, 'style': 0.0, 'use_speaker_boost': True, 'speed': self.speed}}
        headers = {'xi-api-key': api_key, 'Content-Type': 'application/json'}
        if progress_cb:
            progress_cb(f'📡 Gửi ElevenLabs (relay key ..{api_key[-4:]})...')
        resp = requests.post(url, json=payload, headers=headers, params={'output_format': 'mp3_44100_128'}, timeout=60, proxies=self._proxies)
        if resp.status_code == 200:
            if progress_cb:
                progress_cb('⬇️ Đang lưu audio...')
            with open(output_path, 'wb') as f:
                f.write(resp.content)
            if os.path.getsize(output_path) == 0:
                raise RuntimeError('ElevenLabs API: file audio trả về rỗng!')
            return output_path
        raise RuntimeError(f'EL relay-key HTTP {resp.status_code}: {resp.text[:200]}')

    def _generate_via_relay(self, text: str, output_path: str, progress_cb: Callable[[str], None] | None) -> str:
        import requests
        url = f'{self._relay_url}/el/tts'
        payload = {'text': text, 'voice_id': self.voice, 'model_id': 'eleven_multilingual_v2', 'output_format': 'mp3_44100_128', 'voice_settings': {'stability': 0.5, 'similarity_boost': 0.75, 'style': 0.0, 'use_speaker_boost': True, 'speed': self.speed}}
        headers = {'Content-Type': 'application/json'}
        try:
            from ._relay_auth import relay_auth_headers
            headers.update(relay_auth_headers(self._relay_secret))
        except Exception:
            if self._relay_secret:
                headers['X-Relay-Secret'] = self._relay_secret
        if progress_cb:
            progress_cb('📡 Gửi qua Relay server...')
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=90, proxies=self._proxies)
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f'❌ Relay lỗi kết nối: {e}')
        if resp.status_code == 200:
            if progress_cb:
                _used = resp.headers.get('X-Key-Used', '')
                progress_cb(f"⬇️ Đang lưu audio...{(f' ({_used})' if _used else '')}")
            with open(output_path, 'wb') as f:
                f.write(resp.content)
            if os.path.getsize(output_path) == 0:
                raise RuntimeError('Relay: file audio trả về rỗng!')
            return output_path
        try:
            err_body = resp.json()
        except Exception:
            err_body = {'error': resp.text[:300]}
        raise RuntimeError(f"❌ Relay: hết key! ({err_body.get('detail', '')})\nTổng key trên server: {err_body.get('total_keys', '?')}\nThêm key mới vào Relay hoặc dùng engine khác." if resp.status_code == 503 else '❌ Giọng đọc này cần trả phí!\nDùng giọng Premade (21 giọng đầu) nếu key miễn phí.' if resp.status_code == 402 else '❌ Relay: sai Relay Secret! Kiểm tra lại.' if resp.status_code == 401 else f"❌ Relay lỗi HTTP {resp.status_code}: {err_body.get('error', resp.text[:200])}")

    def _generate_direct(self, text: str, output_path: str, progress_cb: Callable[[str], None] | None) -> str:
        import requests
        url = f'{self._BASE_URL}/{self.voice}'
        payload = {'text': text, 'model_id': 'eleven_multilingual_v2', 'voice_settings': {'stability': 0.5, 'similarity_boost': 0.75, 'style': 0.0, 'use_speaker_boost': True, 'speed': self.speed}}
        last_err = None
        _max_attempts = self._rotator.count * 2 + 1
        for _attempt in range(_max_attempts):
            key = self._rotator.get()
            if key:
                headers = {'xi-api-key': key, 'Content-Type': 'application/json'}
                if progress_cb:
                    _kn = f' (key ..{key[-4:]})' if self._rotator.count > 1 else ''
                    progress_cb(f'📡 Gửi yêu cầu ElevenLabs...{_kn}')
                try:
                    resp = requests.post(url, json=payload, headers=headers, params={'output_format': 'mp3_44100_128'}, timeout=60, proxies=self._proxies)
                    if resp.status_code == 200:
                        if progress_cb:
                            progress_cb('⬇️ Đang lưu audio...')
                        with open(output_path, 'wb') as f:
                            f.write(resp.content)
                        if os.path.getsize(output_path) == 0:
                            raise RuntimeError('ElevenLabs API: file audio tải về rỗng!')
                        return output_path
                    if resp.status_code == 429:
                        self._rotator.mark_exhausted(key)
                        last_err = f'Key ..{key[-4:]} hết quota'
                        if progress_cb:
                            progress_cb(f'⚠️ {last_err}, thử key tiếp...')
                    elif resp.status_code == 401:
                        try:
                            _body = resp.json()
                            _detail = _body.get('detail', {})
                            if isinstance(_detail, dict) and _detail.get('status') == 'detected_unusual_activity':
                                raise RuntimeError('❌ ElevenLabs chặn IP của bạn!\nLỗi: "Unusual activity detected" — Free Tier bị vô hiệu hoá.\n\nGiải pháp:\n• Dùng proxy/VPN (nhập ở ô Proxy bên dưới)\n• Đổi IP mạng (tắt/bật modem/router)\n• Dùng engine khác: SiliconFlow, Edge, Zalo, VieNeu\n• Hoặc mua gói ElevenLabs trả phí')
                        except (ValueError, KeyError, AttributeError):
                            pass
                        self._rotator.mark_exhausted(key)
                        last_err = f'Key ..{key[-4:]} không hợp lệ (401)'
                        if progress_cb:
                            progress_cb(f'⚠️ {last_err}, thử key tiếp...')
                    else:
                        if resp.status_code == 402:
                            raise RuntimeError('❌ Giọng đọc này cần trả phí!\nGiọng community (VN/Hàn/Nhật/Trung) yêu cầu key ElevenLabs trả phí.\nDùng key miễn phí → chọn giọng Premade (21 giọng đầu danh sách).')
                        if resp.status_code == 422:
                            raise RuntimeError(f'❌ ElevenLabs lỗi request: {resp.text[:200]}')
                        self._rotator.mark_exhausted(key)
                        last_err = f'Key ..{key[-4:]} HTTP {resp.status_code}'
                        if progress_cb:
                            progress_cb(f'⚠️ {last_err}, thử key tiếp...')
                except requests.exceptions.RequestException as e:
                    self._rotator.mark_exhausted(key)
                    last_err = f'Key ..{key[-4:]} lỗi kết nối: {e}'
                    if progress_cb:
                        progress_cb(f'⚠️ {last_err}, thử key tiếp...')
            else:
                break
        raise RuntimeError(f'❌ Hết quota tất cả ElevenLabs key! ({last_err})\nChờ reset hoặc thêm key mới.')