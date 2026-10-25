"""Draw the app's original wheat mark; no external artwork or fonts required."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent / 'assets'
SCALE = 3
GOLD = '#E4B94E'
NAVY = '#123047'

def point(x, y):
    return (round(x * SCALE), round(y * SCALE))

def curve(points, steps=48):
    p0, p1, p2, p3 = points
    return [point(*[(1-t)**3*p0[k] + 3*(1-t)**2*t*p1[k] + 3*(1-t)*t*t*p2[k] + t**3*p3[k] for k in range(2)])
            for t in [i/steps for i in range(steps+1)]]

def mark(color):
    image = Image.new('RGBA', (1024*SCALE, 1024*SCALE))
    draw = ImageDraw.Draw(image)
    draw.line([point(512, 782), point(512, 292)], fill=color, width=14*SCALE)
    for y in [408, 498, 588, 678]:
        for side in [-1, 1]:
            tip = (512 + side*112, y - 65)
            end = (512 + side*10, y + 8)
            contour = curve([end, (512+side*100, y+20), (512+side*133, y-25), tip])
            contour += curve([tip, (512+side*38,y-61), (512+side*3,y-24), end])
            draw.polygon(contour, fill=color)
            draw.line([point(*tip), point(tip[0]+side*17,tip[1]-62)], fill=color, width=6*SCALE)
    top = curve([(512,347),(450,304),(485,247),(512,210)]) + curve([(512,210),(539,247),(574,304),(512,347)])
    draw.polygon(top, fill=color)
    return image.resize((1024,1024), Image.Resampling.LANCZOS)

foreground = mark(GOLD)
foreground.save(ROOT / 'wheat-foreground.png')
mark('#FFFFFF').save(ROOT / 'wheat-monochrome.png')
background = Image.new('RGBA', (1024,1024), NAVY)
background.alpha_composite(foreground)
background.convert('RGB').save(ROOT / 'wheat-icon.png')
print('Created wheat icon, adaptive foreground and monochrome mark.')
