'use strict';

/* imzic-glsl.js — mini WebGL2 engine cho FX shader (canvas offscreen → vẽ vào
 * khung chính bằng drawImage). Vai trò tương đương glea.js của Vizzy
 * (learosema/glea, MIT) — nhưng tự viết ~90 dòng, KHÔNG thêm dependency (Luật 9/§4.1).
 * Hợp đồng:
 *   imzGLEnsure()        → trả {gl, canvas}; LỖI ném Error với code IMZIC_NO_WEBGL2
 *                          (fail-loud — Luật 10, không fallback ngầm).
 *   imzGLRender(name, frag, srcCanvas, w, h, uni)
 *                        → compile+cache program theo name, nạp srcCanvas làm
 *                          texture uTex, set uniform chuẩn + uni phụ, vẽ 1 tam
 *                          giác full-screen, trả canvas offscreen để caller drawImage.
 * Uniform sẵn có trong mọi shader: uRes (vec2), uTime (float, ms frame), uBass,
 * uLevel (0..1), uTex (sampler2D — nội dung khung hiện tại).
 * Nạp TRƯỚC imzic-fx.js. Tiền tố imzGL* — duy nhất toàn trang img-to-vid.html.
 */

const imzGL_VERT = '#version 300 es\n' +
  'const vec2 P[3] = vec2[3](vec2(-1.,-1.), vec2(3.,-1.), vec2(-1.,3.));\n' +
  'void main(){ gl_Position = vec4(P[gl_VertexID], 0., 1.); }\n';

let imzGLCtx = null;               // {gl, canvas}
let imzGLPrograms = Object.create(null);
let imzGLTex = null;
let imzGLLost = false;             // GPU reset/tab nền → context vừa bị mất

function imzGLEnsure(){
  if(imzGLCtx) return imzGLCtx;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
  if(!gl){
    // Fail-loud có chủ đích — máy --disable-gpu hoặc driver cũ sẽ vào đây
    const err = new Error('WebGL2 không khả dụng cho FX shader');
    err.code = 'IMZIC_NO_WEBGL2';
    throw err;
  }
  // GPU reset / driver crash → webglcontextlost. Chặn default (hủy mọi Event
  // Listener), đánh dấu LOST — imzGLRender ném IMZIC_GL_CONTEXT_LOST để caller
  // báo 1 lần rồi vẽ khung gốc; khi context restore → xoá sạch cache program/
  // texture (đã invalid) để frame kế recompile và render lại như thường.
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    imzGLLost = true;
    imzGLPrograms = Object.create(null);
    try { gl.deleteTexture(imzGLTex); } catch (err2) {}
    imzGLTex = null;
  }, false);
  canvas.addEventListener('webglcontextrestored', () => {
    imzGLLost = false;
  }, false);
  imzGLCtx = { gl: gl, canvas: canvas };
  return imzGLCtx;
}

function imzGLCompile(name, frag){
  if(imzGLPrograms[name]) return imzGLPrograms[name];
  const gl = imzGLCtx.gl;
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
      const err = new Error('IMZIC_GL_COMPILE [' + name + ']: ' + gl.getShaderInfoLog(s));
      err.code = 'IMZIC_GL_COMPILE';
      throw err;
    }
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, imzGL_VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){
    const err = new Error('IMZIC_GL_LINK [' + name + ']: ' + gl.getProgramInfoLog(prog));
    err.code = 'IMZIC_GL_LINK';
    throw err;
  }
  imzGLPrograms[name] = prog;
  return prog;
}

// ---- Shader nguồn (GLSL ES 3.0) — credit nguồn mở của Vizzy ----

// God rays — volumetric light scattering (shadertoy ls2Xzd, thuật gốc của Vizzy):
// sample dọc tia từ vị trí nắng với decay/weight/density, chỉ giữ phần tia ấm cộng
// vào khung gốc. Deterministic: không phụ thuộc thời gian thực, chỉ uTime = frame.
const imzGL_FRAG_GODRAYS = '#version 300 es\n' +
'precision highp float;\n' +
'uniform sampler2D uTex; uniform vec2 uRes; uniform float uTime, uBass, uLevel;\n' +
'out vec4 fragColor;\n' +
'void main(){\n' +
'  vec2 uv = gl_FragCoord.xy / uRes;\n' +
'  vec2 lightPos = vec2(0.5 + 0.16*sin(uTime*0.0019), 1.06);\n' +
'  vec2 dir = uv - lightPos;\n' +
'  float density = 0.22 + 0.13*uLevel;\n' +
'  float decay = 0.945, weight = 0.135, exposure = 0.28 + 0.30*uLevel + 0.35*uBass;\n' +
'  vec2 coord = uv;\n' +
'  vec2 delta = dir * density / 60.0;\n' +
'  float illum = 1.0;\n' +
'  vec3 acc = vec3(0.0);\n' +
'  for(int i = 0; i < 60; i++){\n' +
'    coord -= delta;\n' +
'    acc += texture(uTex, coord).rgb * weight * illum;\n' +
'    illum *= decay;\n' +
'  }\n' +
'  float lum = dot(acc, vec3(0.299, 0.587, 0.114));\n' +
'  vec3 rays = acc * exposure * smoothstep(0.0, 0.35, lum) * vec3(1.0, 0.94, 0.76);\n' +
'  fragColor = vec4(texture(uTex, uv).rgb + rays, 1.0);\n' +
'}\n';

// NTSC composite 1-pass — chưng cất từ MAME hlsl/ntsc.fx (BSD-3; credit nguồn mở
// Vizzy, hằng số CCFrequency + ScanTime giữ nguyên từ bundle Vizzy): encode RGB→YIQ,
// điều chế subcarrier (~189 chu kỳ/dòng quét), decode bằng cửa sổ 12 tap ngang tách
// chroma theo pha (notch), bleed màu theo uLevel. Tĩnh theo thời gian → deterministic.
const imzGL_FRAG_NTSC = '#version 300 es\n' +
'precision highp float;\n' +
'uniform sampler2D uTex; uniform vec2 uRes; uniform float uTime, uBass, uLevel;\n' +
'out vec4 fragColor;\n' +
'const float CCFrequency = 3.59754545;\n' +
'const float ScanTime = 52.6;\n' +
'const float TAU = 6.28318530718;\n' +
'vec3 rgb2yiq(vec3 c){ return vec3(dot(c, vec3(0.299,0.587,0.114)), dot(c, vec3(0.5959,-0.2746,-0.3213)), dot(c, vec3(0.2115,-0.5227,0.3112))); }\n' +
'vec3 yiq2rgb(vec3 c){ return vec3(dot(c, vec3(1.0,0.9563,0.6210)), dot(c, vec3(1.0,-0.2721,-0.6474)), dot(c, vec3(1.0,-1.1070,1.7046))); }\n' +
'void main(){\n' +
'  vec2 uv = gl_FragCoord.xy / uRes;\n' +
'  float cyc = CCFrequency * ScanTime;\n' +
'  vec3 e = rgb2yiq(texture(uTex, uv).rgb);\n' +
'  float halfCyc = 0.5 / cyc;\n' +
'  float accY = 0.0, accI = 0.0, accQ = 0.0;\n' +
'  for(int i = 0; i < 12; i++){\n' +
'    float xo = uv.x + (float(i) - 5.5) / 6.0 * halfCyc;\n' +
'    float wo = TAU * cyc * xo;\n' +
'    vec3 so = rgb2yiq(texture(uTex, vec2(xo, uv.y)).rgb);\n' +
'    float comp = so.x + so.y * cos(wo) + so.z * sin(wo);\n' +
'    accY += so.x; accI += comp * cos(wo); accQ += comp * sin(wo);\n' +
'  }\n' +
'  float bleed = 0.65 + 0.7 * uLevel;\n' +
'  vec3 outc = yiq2rgb(vec3(accY / 12.0 * 0.8 + e.x * 0.2, accI / 12.0 * 2.0 * bleed, accQ / 12.0 * 2.0 * bleed));\n' +
'  fragColor = vec4(clamp(outc, 0.0, 1.0), 1.0);\n' +
'}\n';

// Hue rotate GL — thay tính HSV per-pixel trên CPU (đắt ở 1080×1920 mỗi frame)
// bằng shader. Cùng công thức lệch hue với FX 'huecycle' cũ: shift = fract(
// fr*0.0016 + 0.06*bass) (uTime = số frame — deterministic, Luật 8). Xoay hue
// trong không gian HSV; pixel xám (s≈0) giữ nguyên như nhánh skip của bản CPU.
const imzGL_FRAG_HUE = '#version 300 es\n' +
'precision highp float;\n' +
'uniform sampler2D uTex; uniform vec2 uRes; uniform float uTime, uBass, uLevel;\n' +
'out vec4 fragColor;\n' +
'vec3 rgb2hsv(vec3 c){\n' +
'  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);\n' +
'  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));\n' +
'  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));\n' +
'  float d = q.x - min(q.w, q.y);\n' +
'  return vec3(abs(q.z + (q.w - q.y)/(6.0*d + 1.0e-10)), d/(q.x + 1.0e-10), q.x);\n' +
'}\n' +
'vec3 hsv2rgb(vec3 c){\n' +
'  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);\n' +
'  vec3 p = abs(fract(c.xxx + K.xyz)*6.0 - K.www);\n' +
'  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);\n' +
'}\n' +
'void main(){\n' +
'  vec2 uv = gl_FragCoord.xy / uRes;\n' +
'  vec3 hsv = rgb2hsv(texture(uTex, uv).rgb);\n' +
'  hsv.x = fract(hsv.x + fract(uTime*0.0016 + 0.06*uBass));\n' +
'  fragColor = vec4(hsv2rgb(hsv), 1.0);\n' +
'}\n';

function imzGLRender(name, frag, srcCanvas, w, h, uni){
  const c = imzGLEnsure();
  const gl = c.gl;
  // context đang lost (GPU reset) — ném lỗi có code để caller báo 1 lần rồi vẽ
  // khung gốc; khi restore xong frame kế sẽ tự render lại shader bình thường
  if(imzGLLost){
    const err = new Error('Ngữ cảnh WebGL2 vừa bị mất (GPU reset) — đợi khôi phục.');
    err.code = 'IMZIC_GL_CONTEXT_LOST';
    throw err;
  }
  if(c.canvas.width !== w || c.canvas.height !== h){ c.canvas.width = w; c.canvas.height = h; }
  const prog = imzGLCompile(name, frag);
  gl.useProgram(prog);
  gl.viewport(0, 0, w, h);
  // texture từ khung canvas hiện tại
  if(!imzGLTex) imzGLTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, imzGLTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // canvas 2D gốc Y-trên → GL Y-dưới
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcCanvas);
  const U = (n) => gl.getUniformLocation(prog, n);
  gl.uniform2f(U('uRes'), w, h);
  gl.uniform1f(U('uTime'), (uni && uni.time) || 0);
  gl.uniform1f(U('uBass'), (uni && uni.bass) || 0);
  gl.uniform1f(U('uLevel'), (uni && uni.level) || 0);
  gl.uniform1i(U('uTex'), 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  return c.canvas;
}
