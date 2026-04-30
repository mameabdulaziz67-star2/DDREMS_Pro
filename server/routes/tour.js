const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;

    // Fetch property details + images in parallel
    const [[propRows], [imgRows]] = await Promise.all([
      db.query(`SELECT title, price, location, bedrooms, bathrooms, area, type FROM properties WHERE id = ?`, [propertyId]),
      db.query(`SELECT image_url FROM property_images WHERE property_id = ? ORDER BY is_primary DESC, created_at ASC`, [propertyId])
    ]);

    const prop = (propRows && propRows[0]) || {};
    const imageUrls = (imgRows || []).map(r => r.image_url).filter(Boolean);
    const imagesJson = JSON.stringify(imageUrls);
    const title = (prop.title || 'Property Tour').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const price = prop.price ? '$' + Number(prop.price).toLocaleString() : '';
    const location = (prop.location || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} - 3D Tour</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#000;font-family:system-ui,-apple-system,sans-serif}
canvas{display:block;position:fixed;inset:0;width:100%!important;height:100%!important;cursor:grab}
canvas:active{cursor:grabbing}
#hdr{position:fixed;top:0;left:0;right:0;z-index:50;background:linear-gradient(to bottom,rgba(0,0,0,.85) 0%,transparent 100%);padding:14px 20px;display:flex;justify-content:space-between;align-items:center;pointer-events:none}
#hdr-info{color:#fff;pointer-events:none}
#hdr-title{font-size:1.1rem;font-weight:700;text-shadow:0 1px 4px rgba(0,0,0,.8)}
#hdr-sub{font-size:.85rem;color:#c4b5fd;margin-top:2px;text-shadow:0 1px 3px rgba(0,0,0,.8)}
#back{pointer-events:all;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.3);color:#fff;padding:8px 18px;border-radius:22px;cursor:pointer;font-size:.85rem;font-weight:600;transition:background .2s;backdrop-filter:blur(4px)}
#back:hover{background:rgba(255,255,255,.3)}
#loading{position:fixed;inset:0;background:#0d0d1a;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;z-index:200;gap:18px}
#loading.hidden{display:none}
.sp{width:56px;height:56px;border:4px solid #2d2d4e;border-top-color:#667eea;border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
#loading p{font-size:1rem;color:#a0aec0}
#nav{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);display:none;align-items:center;gap:14px;background:rgba(0,0,0,.75);padding:12px 24px;border-radius:50px;color:#fff;z-index:50;backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.1)}
#nav.show{display:flex}
#nav button{background:rgba(255,255,255,.15);border:none;color:#fff;width:40px;height:40px;border-radius:50%;font-size:20px;cursor:pointer;transition:background .2s;display:flex;align-items:center;justify-content:center}
#nav button:hover{background:rgba(255,255,255,.3)}
#nav button:disabled{opacity:.3;cursor:default}
#ctr{font-size:14px;min-width:70px;text-align:center;font-weight:600}
#hint{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,.8);color:#fff;padding:12px 24px;border-radius:24px;font-size:.95rem;z-index:100;pointer-events:none;animation:fo 3s forwards 2s;backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,.1)}
@keyframes fo{to{opacity:0}}
#none{position:fixed;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;color:#666;background:#0d0d1a;gap:16px;text-align:center;padding:20px}
#none p{font-size:1.1rem;color:#888}
#none button{margin-top:8px;background:rgba(102,126,234,.2);border:1px solid #667eea;color:#a78bfa;padding:10px 24px;border-radius:22px;cursor:pointer;font-size:.9rem;transition:background .2s}
#none button:hover{background:rgba(102,126,234,.35)}
</style>
</head>
<body>
<div id="loading"><div class="sp"></div><p>Loading 3D Tour...</p></div>
<div id="none">
  <span style="font-size:64px;opacity:.2">&#127968;</span>
  <p>No images available for this property.</p>
  <button onclick="window.close()">&#8592; Close</button>
</div>
<div id="hdr">
  <div id="hdr-info">
    <div id="hdr-title">${title}</div>
    <div id="hdr-sub">${price}${price && location ? ' &nbsp;&#183;&nbsp; ' : ''}${location}</div>
  </div>
  <button id="back" onclick="window.close()">&#10005; Close Tour</button>
</div>
<div id="hint">&#128065; Drag to look around &nbsp;&nbsp;&#124;&nbsp;&nbsp; Scroll to zoom</div>
<canvas id="c"></canvas>
<div id="nav">
  <button id="pv" disabled>&#10094;</button>
  <span id="ctr">1 / 1</span>
  <button id="nx" disabled>&#10095;</button>
</div>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"}}</script>
<script type="module">
import * as THREE from 'three';
var imgs = ${imagesJson};
var eL=document.getElementById('loading'),eN=document.getElementById('none'),eNav=document.getElementById('nav'),eCtr=document.getElementById('ctr'),ePv=document.getElementById('pv'),eNx=document.getElementById('nx'),eC=document.getElementById('c');
if(!imgs||!imgs.length){
  eL.classList.add('hidden');
  eN.style.display='flex';
} else {
  var rdr=new THREE.WebGLRenderer({canvas:eC,antialias:true,alpha:false});
  rdr.setPixelRatio(Math.min(devicePixelRatio,2));
  rdr.setSize(innerWidth,innerHeight);
  var sc=new THREE.Scene(),cam=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.1,1000);
  cam.position.set(0,0,.01);
  var geo=new THREE.SphereGeometry(500,64,48);
  geo.scale(-1,1,1);
  var ldr=new THREE.TextureLoader();
  ldr.crossOrigin='anonymous';
  var mesh=null,idx=0;
  function load(i){
    eL.classList.remove('hidden');
    ldr.load(imgs[i],function(t){
      t.colorSpace=THREE.SRGBColorSpace;
      if(mesh){mesh.material.map.dispose();mesh.material.dispose();sc.remove(mesh);}
      mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:t}));
      sc.add(mesh);
      eL.classList.add('hidden');
      eCtr.textContent=(i+1)+' / '+imgs.length;
      ePv.disabled=(i===0);
      eNx.disabled=(i===imgs.length-1);
    },undefined,function(){
      if(mesh)sc.remove(mesh);
      mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0x0d0d1a}));
      sc.add(mesh);
      eL.classList.add('hidden');
      eCtr.textContent=(i+1)+' / '+imgs.length+' (load error)';
    });
  }
  load(0);
  if(imgs.length>1) eNav.classList.add('show');
  ePv.onclick=function(){if(idx>0)load(--idx);};
  eNx.onclick=function(){if(idx<imgs.length-1)load(++idx);};
  var drag=false,pm={x:0,y:0},lon=0,lat=0;
  eC.addEventListener('mousedown',function(e){drag=true;pm={x:e.clientX,y:e.clientY};});
  window.addEventListener('mouseup',function(){drag=false;});
  eC.addEventListener('mousemove',function(e){
    if(!drag)return;
    lon-=(e.clientX-pm.x)*.15;
    lat=Math.max(-85,Math.min(85,lat+(e.clientY-pm.y)*.15));
    pm={x:e.clientX,y:e.clientY};
  });
  var pt=null;
  eC.addEventListener('touchstart',function(e){pt=e.touches[0];},{passive:true});
  eC.addEventListener('touchmove',function(e){
    if(!pt)return;
    lon-=(e.touches[0].clientX-pt.clientX)*.2;
    lat=Math.max(-85,Math.min(85,lat+(e.touches[0].clientY-pt.clientY)*.2));
    pt=e.touches[0];
  },{passive:true});
  eC.addEventListener('touchend',function(){pt=null;});
  var fov=75;
  eC.addEventListener('wheel',function(e){
    fov=Math.max(30,Math.min(100,fov+e.deltaY*.05));
    cam.fov=fov;cam.updateProjectionMatrix();
  },{passive:true});
  window.addEventListener('resize',function(){
    cam.aspect=innerWidth/innerHeight;
    cam.updateProjectionMatrix();
    rdr.setSize(innerWidth,innerHeight);
  });
  (function anim(){
    requestAnimationFrame(anim);
    var phi=THREE.MathUtils.degToRad(90-lat),theta=THREE.MathUtils.degToRad(lon);
    cam.lookAt(500*Math.sin(phi)*Math.cos(theta),500*Math.cos(phi),500*Math.sin(phi)*Math.sin(theta));
    rdr.render(sc,cam);
  })();
}
</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('[TOUR] Error:', err.message);
    res.status(500).send(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;background:#0d0d1a;color:#fff">
      <h2>Tour Error</h2><p style="color:#f87171;margin-top:12px">${err.message}</p>
      <button onclick="window.close()" style="margin-top:20px;padding:10px 20px;background:#667eea;border:none;color:white;border-radius:8px;cursor:pointer">Close</button>
    </body></html>`);
  }
});

module.exports = router;
