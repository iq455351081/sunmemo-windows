# Compose line-hero.png (clean rope on sky gradient) + 06-imgzoom.png (real photo before/after)
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

base = r'E:\Agentic_Engineering\ZCode\sunidea'
try:
    font_l = ImageFont.truetype(r'C:\Windows\Fonts\msyh.ttc', 30)
    font_s = ImageFont.truetype(r'C:\Windows\Fonts\msyh.ttc', 22)
except Exception:
    font_l = font_s = ImageFont.load_default()

# ---- 1) line-hero：纯净绳渲染贴到天空渐变画布 ----
rope = Image.open(os.path.join(base, '_docs', 'rope-clean.png')).convert('RGBA')
# 目标画布 2200x760；绳图缩放到 2100 宽
rw = 2100
rh = round(rope.height * rw / rope.width)
rope_r = rope.resize((rw, rh), Image.LANCZOS)

W, H = 2260, rh + 190
canvas = Image.new('RGBA', (W, H))
d = ImageDraw.Draw(canvas)
for y in range(H):
    t = y / H
    c = (int(126 + (255 - 126) * t ** 1.2), int(199 + (247 - 199) * t), int(246 - 18 * t))
    d.line([(0, y), (W, y)], fill=c + (255,))

# 圆角蒙版 + 投影
mask = Image.new('L', (rw, rh), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, rw, rh], radius=26, fill=255)
shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle([130, 108, 130 + rw, 108 + rh], radius=26, fill=(30, 60, 110, 90))
shadow = shadow.filter(ImageFilter.GaussianBlur(22))
canvas.alpha_composite(shadow)
canvas.paste(rope_r, (130, 100), mask)
canvas.convert('RGB').save(os.path.join(base, 'docs', 'img', 'line-hero.png'))
print('line-hero.png', canvas.size)

# ---- 2) 06-imgzoom：真实照片 悬停前/后 ----
before = Image.open(os.path.join(base, '_shots', 'real-before.png')).convert('RGB')
after = Image.open(os.path.join(base, '_shots', 'real-hover.png')).convert('RGB')
# 目标卡中心（窗口物理坐标）
cx, top, bot = 1569, 0, 400
bw = 620
b1 = before.crop((max(0, cx - bw), top, min(before.width, cx + bw), bot))
b2 = after.crop((max(0, cx - bw), top, min(after.width, cx + bw), bot))

GUT, TOP, PAD = 30, 66, 16
W2 = b1.width + b2.width + GUT + PAD * 2
H2 = b1.height + TOP + PAD * 2
canvas2 = Image.new('RGB', (W2, H2), (246, 247, 250))
d2 = ImageDraw.Draw(canvas2)
canvas2.paste(b1, (PAD, TOP))
canvas2.paste(b2, (PAD + b1.width + GUT, TOP))

def label_center(dr, cxp, text, f, fill):
    bb = dr.textbbox((0, 0), text, font=f)
    dr.text((cxp - (bb[2] - bb[0]) / 2, (TOP - (bb[3] - bb[1])) / 2 - bb[1]), text, font=f, fill=fill)

c1 = PAD + b1.width // 2
c2 = PAD + b1.width + GUT + b2.width // 2
label_center(d2, c1, '鼠标悬停前', font_s, (90, 96, 110))
label_center(d2, c2, '悬停 · 自动放大 ×3', font_l, (232, 92, 40))
bb = d2.textbbox((0, 0), '悬停 · 自动放大 ×3', font=font_l)
d2.line([(c2 - (bb[2] - bb[0]) / 2, TOP - 8), (c2 + (bb[2] - bb[0]) / 2, TOP - 8)], fill=(255, 170, 90), width=3)

out2 = os.path.join(base, 'docs', 'img', '06-imgzoom.png')
canvas2.save(out2)
print('06-imgzoom.png', canvas2.size)
