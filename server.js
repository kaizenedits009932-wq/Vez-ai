const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const OUT = path.join(ROOT, 'renders');
fs.mkdirSync(OUT, { recursive: true });
app.use(express.static(ROOT));
app.use('/renders', express.static(OUT));

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 300 * 1024 * 1024, files: 2 }
});

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stderr = '';
    child.stderr.on('data', d => stderr += d.toString());
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(stderr.slice(-1800) || `${command} falhou`)));
  });
}

async function createPlan(prompt, format) {
  if (!process.env.OPENAI_API_KEY) throw new Error('Falta configurar OPENAI_API_KEY no arquivo .env.');
  const system = `Você é um assistente de edição de vídeo. Converta o pedido do usuário em um plano JSON para FFmpeg. Retorne SOMENTE JSON com estas chaves: style (cinematic|vibrant|anime|mono|clean), speed (0.75|1|1.25|1.5), zoom (0|1|2), shake (boolean), sharpen (boolean), vignette (boolean), subtitles (string). Não invente conteúdo de fala. Use apenas valores permitidos. Preserve o sentido do pedido. Se não pedir efeito específico, escolha clean, velocidade 1 e efeitos falsos.`;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: `Formato: ${format}. Pedido: ${prompt}` }],
      temperature: 0.2
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Falha ao interpretar o pedido pela IA.');
  let plan = JSON.parse(data.choices[0].message.content);
  const styles = ['cinematic','vibrant','anime','mono','clean'];
  if (!styles.includes(plan.style)) plan.style = 'clean';
  if (![0.75,1,1.25,1.5].includes(Number(plan.speed))) plan.speed = 1;
  if (![0,1,2].includes(Number(plan.zoom))) plan.zoom = 0;
  return plan;
}

function videoFilters(plan, format) {
  const f = [];
  if (format === 'vertical') f.push("scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920");
  else if (format === 'square') f.push("scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080");
  else if (format === 'wide') f.push("scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080");
  if (plan.style === 'cinematic') f.push('eq=contrast=1.18:saturation=1.22:brightness=-0.02');
  if (plan.style === 'vibrant') f.push('eq=contrast=1.12:saturation=1.55');
  if (plan.style === 'anime') f.push('eq=contrast=1.3:saturation=1.65:brightness=0.02,unsharp=5:5:0.8');
  if (plan.style === 'mono') f.push('hue=s=0,eq=contrast=1.15');
  if (plan.style === 'clean') f.push('eq=contrast=1.04:saturation=1.08');
  if (plan.sharpen) f.push('unsharp=5:5:0.7:5:5:0.0');
  if (plan.vignette) f.push('vignette=PI/5');
  if (Number(plan.zoom) > 0) f.push(`scale=iw*${1 + Number(plan.zoom)*0.025}:ih*${1 + Number(plan.zoom)*0.025},crop=iw/${1 + Number(plan.zoom)*0.025}:ih/${1 + Number(plan.zoom)*0.025}`);
  if (plan.shake) f.push('rotate=0.008*sin(18*t):fillcolor=black@0');
  f.push(`setpts=${1 / Number(plan.speed)}*PTS`);
  f.push('fps=30');
  return f.join(',');
}

app.post('/api/edit', upload.fields([{ name: 'video', maxCount: 1 }, { name: 'music', maxCount: 1 }]), async (req, res) => {
  const video = req.files?.video?.[0];
  const music = req.files?.music?.[0];
  let outputPath;
  try {
    if (!video) return res.status(400).json({ error: 'Envie um vídeo.' });
    const prompt = String(req.body.prompt || '').slice(0, 2000);
    if (!prompt.trim()) return res.status(400).json({ error: 'Escreva como deseja editar.' });
    const format = ['original','vertical','square','wide'].includes(req.body.format) ? req.body.format : 'original';
    const plan = await createPlan(prompt, format);
    outputPath = path.join(OUT, `vex-${Date.now()}.mp4`);
    const inputPath = video.path;
    const filters = videoFilters(plan, format);
    const args = ['-y', '-i', inputPath];
    if (music) args.push('-stream_loop', '-1', '-i', music.path);
    args.push('-vf', filters, '-map', '0:v:0');
    if (music) args.push('-map', '1:a:0', '-shortest', '-c:a', 'aac', '-b:a', '192k');
    else args.push('-map', '0:a?', '-c:a', 'aac', '-b:a', '192k');
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outputPath);
    await run(process.env.FFMPEG_PATH || 'ffmpeg', args);
    res.json({ ok: true, downloadUrl: `/renders/${path.basename(outputPath)}`, plan });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Erro ao processar o vídeo.' });
  } finally {
    if (video?.path) fs.promises.unlink(video.path).catch(() => {});
    if (music?.path) fs.promises.unlink(music.path).catch(() => {});
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.listen(PORT, () => console.log(`VEX AI Studio em http://localhost:${PORT}`));
