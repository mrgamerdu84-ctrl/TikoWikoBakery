/* TikoWikoBakery — correctifs mobiles et vrais visuels fournis. */
(() => {
  const asset = name => new URL(`./assets/${name}`, import.meta.url).href;
  const iconUrl = asset('icon-only.svg');
  const splashUrl = asset('splash.svg');

  const style = document.createElement('style');
  style.textContent = `
    html,body{
      width:100%;height:100%;min-height:100dvh;
      overflow:hidden!important;overscroll-behavior:none;
      touch-action:none;-webkit-user-select:none;user-select:none;
      background:#211006!important;
    }
    #canvas-wrap{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;}
    #canvas-wrap canvas{width:100%!important;height:100%!important;touch-action:none!important;}
    #twSplash{background:#2b160b center/cover no-repeat!important;overflow:hidden!important;display:block!important;}
    #twPlay{z-index:5!important;bottom:5.5%!important;width:min(72vw,410px)!important;height:min(18vw,112px)!important;}
    #twLoad{z-index:6!important;bottom:max(1.2%,env(safe-area-inset-bottom))!important;}
    #twLoad span{display:block;white-space:nowrap;}

    @media (max-width:900px){
      #topbar{
        top:max(5px,env(safe-area-inset-top))!important;
        left:6px!important;right:6px!important;
        display:flex!important;flex-wrap:nowrap!important;
        align-items:center!important;gap:5px!important;
        padding:5px!important;border-radius:16px!important;
        overflow-x:auto!important;overflow-y:hidden!important;
        scrollbar-width:none!important;-webkit-overflow-scrolling:touch;
      }
      #topbar::-webkit-scrollbar,#quickbar::-webkit-scrollbar{display:none;}
      .logo-badge{flex:0 0 auto!important;padding:3px 8px 3px 3px!important;}
      .tw-logo{width:30px!important;height:30px!important;border-radius:9px!important;}
      .logo-badge .title{font-size:11px!important;line-height:1!important;}
      .logo-badge .title span{display:none!important;}
      .stat-pill{flex:0 0 auto!important;padding:5px 7px!important;font-size:10px!important;gap:3px!important;}
      #xpwrap{flex:0 0 108px!important;min-width:108px!important;max-width:108px!important;padding:4px 7px!important;}
      #xpwrap .lvl{width:21px!important;height:21px!important;font-size:10px!important;}
      #clockpill{flex:0 0 auto!important;padding:3px 7px!important;font-size:9px!important;}
      #clockpill b{font-size:11px!important;}
      #soundBtn{flex:0 0 30px!important;width:30px!important;height:30px!important;font-size:13px!important;}
      #goalbar{
        top:calc(max(5px,env(safe-area-inset-top)) + 51px)!important;
        left:7px!important;right:7px!important;transform:none!important;
        width:auto!important;max-width:none!important;
        justify-content:center!important;gap:6px!important;
        padding:5px 8px!important;border-radius:12px!important;
        font-size:9px!important;white-space:nowrap!important;
      }
      #goalbar .goal-track{width:70px!important;}
      #quickbar{
        left:6px!important;right:6px!important;
        bottom:max(5px,env(safe-area-inset-bottom))!important;
        display:flex!important;justify-content:flex-start!important;
        flex-wrap:nowrap!important;gap:6px!important;
        padding:6px!important;border-radius:17px!important;
        overflow-x:auto!important;overflow-y:hidden!important;
        scrollbar-width:none!important;-webkit-overflow-scrolling:touch;
      }
      .qbtn{flex:0 0 58px!important;min-width:58px!important;padding:5px 6px!important;border-radius:12px!important;font-size:9px!important;line-height:1.05!important;}
      .qbtn .qicon{font-size:20px!important;}
      #sidepanel{width:100%!important;max-width:none!important;right:-100%!important;padding-top:env(safe-area-inset-top)!important;padding-bottom:env(safe-area-inset-bottom)!important;}
      #sidepanel.open{right:0!important;}
      .panel-header{padding:10px 12px!important;}
      .panel-header h2{font-size:17px!important;}
      .tabs{gap:4px!important;padding:7px 7px 0!important;}
      .tab{min-width:60px!important;padding:7px 4px!important;font-size:10px!important;}
      .panel-body{padding:8px!important;}
      .shop-item{padding:8px!important;margin-bottom:7px!important;}
      #hint{display:none!important;}
      #toast-layer{top:calc(max(5px,env(safe-area-inset-top)) + 88px)!important;width:94%!important;}
      .reward-card{width:calc(100vw - 28px)!important;max-width:360px!important;padding:20px!important;}
    }

    @media (max-height:520px) and (orientation:landscape){
      #goalbar{display:none!important;}
      .qbtn{flex-basis:52px!important;min-width:52px!important;padding:4px!important;}
      .qbtn .qicon{font-size:17px!important;}
    }
  `;
  document.head.appendChild(style);

  const logo = document.querySelector('.tw-logo');
  if (logo) logo.src = iconUrl;

  const splash = document.getElementById('twSplash');
  if (splash) {
    splash.style.backgroundImage = `url("${splashUrl}")`;
    const play = splash.querySelector('#twPlay');
    const fill = splash.querySelector('#twBar i');
    const label = splash.querySelector('#twLoad span');
    const forceReady = () => {
      if (fill) fill.style.width = '100%';
      if (label) label.textContent = 'La boulangerie est ouverte !';
      if (play) play.classList.add('ready');
      splash.dataset.ready = '1';
    };
    setTimeout(forceReady, 2300);
    const dismiss = () => {
      if (splash.dataset.ready !== '1' && !(play && play.classList.contains('ready'))) return;
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 650);
    };
    splash.addEventListener('click', dismiss);
    splash.addEventListener('touchend', dismiss, {passive:true});
  }

  const coarse = matchMedia('(pointer:coarse)').matches;
  const mobile = coarse || Math.min(innerWidth, innerHeight) < 900;
  if (mobile) {
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.15));
    controls.rotateSpeed = 0.42;
    controls.zoomSpeed = 0.58;
    controls.panSpeed = 0.45;
    controls.enablePan = false;
    key.shadow.mapSize.set(1024, 1024);
    renderer.domElement.style.touchAction = 'none';
    const portrait = innerHeight >= innerWidth;
    if (portrait && !sessionStorage.getItem('twMobileCameraV2')) {
      camera.position.set(10.2, 8.0, 11.8);
      controls.target.set(0, 1.25, -0.15);
      controls.update();
      sessionStorage.setItem('twMobileCameraV2', '1');
    }
  }

  function applyViewport() {
    const viewport = window.visualViewport;
    const width = Math.max(1, Math.round(viewport ? viewport.width : innerWidth));
    const height = Math.max(1, Math.round(viewport ? viewport.height : innerHeight));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = height >= width ? 46 : 36;
    camera.updateProjectionMatrix();
  }
  applyViewport();
  addEventListener('resize', applyViewport, {passive:true});
  addEventListener('orientationchange', () => setTimeout(applyViewport, 180), {passive:true});
  if (window.visualViewport) visualViewport.addEventListener('resize', applyViewport, {passive:true});
})();
