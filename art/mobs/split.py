# Cuts the Grok mob sheets (3 rows: standing, attack, walk) into art/mobs/<id>/{idle,attack,walk}_sheet.png,
# mirrored to face right. Run: python3 art/mobs/split.py <folder with the Grok jpgs>
import numpy as np, os, sys
from PIL import Image
S=sys.argv[1].rstrip('/')+'/'; D=os.path.dirname(os.path.abspath(__file__))+'/'
def bg(a):
    r,g,b=[a[...,i].astype(int) for i in range(3)]
    l=0.3*r+0.59*g+0.11*b
    return (b-r<=20)&(l<130)&(((r-g>80)&(b-g>40))|((r>60)&(g<30)&(b>40)&(r-g>50)))
def rows(a):
    fg=(~bg(a)).sum(1)>=3
    out=[];y=0;H=len(fg)
    while y<H:
        if fg[y]:
            y0=y
            while y<H and fg[y]: y+=1
            if y-y0>40: out.append((y0,y))
        else: y+=1
    return out
def save(img,mob,name):
    os.makedirs(D+mob,exist_ok=True)
    img.transpose(Image.FLIP_LEFT_RIGHT).convert('RGBA').save(D+mob+'/'+name+'_sheet.png')
for mob,f in [('brute','Pzvqj'),('caster','332t9'),('flyer','agyGL'),('scuttler','PIGqy')]:
    im=Image.open(S+f+'.jpg').convert('RGB'); a=np.array(im); rs=rows(a); print(mob,rs)
    assert len(rs)==3
    for (y0,y1),n in zip(rs,['idle','attack','walk']):
        save(im.crop((0,max(0,y0-8),im.width,min(im.height,y1+8))),mob,n)
# The grunt came as separate images; its standalone pose was drawn apart and doesn't match, so it has none.
for f,n in [('WuvID (1)','attack'),('3iSe5','walk')]:
    save(Image.open(S+f+'.jpg').convert('RGB'),'grunt',n)
