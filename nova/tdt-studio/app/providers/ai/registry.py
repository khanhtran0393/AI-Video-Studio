import os
from providers.ai.base import ProviderSpec
_OMNIROUTE_BASE_URL = os.environ.get('VTP_OMNIROUTE_BASE_URL', '').strip() or 'http://192.168.1.101:20128/v1'
PROVIDERS = (ProviderSpec('gemini', 'Google Gemini', 'gemini', 'https://generativelanguage.googleapis.com/v1beta', models=('gemini-3.6-flash', 'gemini-3.6-pro')), ProviderSpec('openai', 'OpenAI', 'openai', 'https://api.openai.com/v1', models=('gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-5.6-luna')), ProviderSpec('kira', 'Kira AI', 'kira', 'https://kiraai.vn/api/v1'), ProviderSpec('groq', 'Groq', 'groq', 'https://api.groq.com/openai/v1', models=('llama-3.3-70b-versatile', 'openai/gpt-oss-120b')), ProviderSpec('deepseek', 'DeepSeek', 'deepseek', 'https://api.deepseek.com', models=('deepseek-v4-flash', 'deepseek-v4-pro')), ProviderSpec('nube', 'Nube AI', 'nube', 'https://ai.nube.sh/api/v1', models=('DeepSeek-V4-Flash', 'DeepSeek-V4-Flash-eons', 'Nube-Choice', 'GLM-5.1', 'GLM-5.2', 'Kimi-K2.5', 'Kimi-K2.6')), ProviderSpec('tokenhub', 'Tencent TokenHub', 'tokenhub', 'https://tokenhub-intl.tencentcloudmaas.com/v1', models=('deepseek-v4-flash-202605', 'deepseek-v4-flash', 'deepseek-v4-pro')), ProviderSpec('xai', 'xAI', 'xai', 'https://api.x.ai/v1', models=('grok-4.20',)), ProviderSpec('byteplus', 'BytePlus ModelArk', 'byteplus', 'https://ark.ap-southeast.bytepluses.com/api/v3', models=('hy-mt2-plus', 'deepseek-v4-flash', 'deepseek-v4-pro')), ProviderSpec('nvidia', 'NVIDIA NIM (DeepSeek)', 'nvidia', 'https://integrate.api.nvidia.com/v1', models=('deepseek-ai/deepseek-v4-flash', 'deepseek-ai/deepseek-v4', 'meta/llama-3.3-70b-instruct')), ProviderSpec('omniroute', 'OmniRoute (LAN)', 'omniroute', _OMNIROUTE_BASE_URL, models=('auto/cheap', 'auto/best-free', 'auto/fast', 'auto/best-chat', 'auto/chat', 'auto/best-fast', 'oc/deepseek-v4-flash-free', 'oc/qwen3.6-plus-free', 'auto/gemini', 'auto/llama')), ProviderSpec('local', 'Model cục bộ', 'local', '', offline=True, models=('local',), translation=False))

def get_provider(provider_id: str) -> ProviderSpec:
    provider = next((item for item in PROVIDERS if item.id == str(provider_id or '').strip()), None)
    if provider is None:
        raise ValueError('Không nhận ra nhà cung cấp AI')
    return provider

def models_for(provider_id: str) -> tuple[str, '<ANTI-DIS: ellipsis Ellipsis>']:
    return get_provider(provider_id).models