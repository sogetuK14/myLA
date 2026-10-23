(()=>{
  "use strict";
  const PROTOCOL="la-service-v1",CACHE_KEY="life_archive_service_summaries_v1";
  const services={
    hikachoku:{origin:"https://sogetuk14.github.io",frame:"hikachokuStatusFrame"},
    sakumeru:{origin:"https://pp-hibithx.github.io",frame:"sakumeruFrame"}
  };
  let refreshRun=0,pendingServices=new Set();
  let sakumeruSummaryWindow=null;
  const state=(()=>{try{return JSON.parse(localStorage.getItem(CACHE_KEY)||"{}")||{}}catch{return {}}})();
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  function timeText(value){
    const date=new Date(value);if(Number.isNaN(date.getTime()))return "未取得";
    const seconds=Math.max(0,Math.floor((Date.now()-date.getTime())/1000));
    if(seconds<60)return "たった今";if(seconds<3600)return `${Math.floor(seconds/60)}分前`;if(seconds<86400)return `${Math.floor(seconds/3600)}時間前`;
    return date.toLocaleString("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});
  }
  function status(summary){
    if(!summary)return {label:"接続待ち",className:"waiting"};
    const age=Date.now()-new Date(summary.receivedAt||summary.generatedAt||0).getTime();
    if(!Number.isFinite(age)||age>10*60*1000)return {label:"前回データ",className:"stale"};
    return {label:"接続済み",className:"online"};
  }
  function card(service,summary){
    const st=status(summary),metrics=summary?.metrics||{},next=summary?.nextAction;
    if(service==="hikachoku")return `<article class="la-service-card"><div class="la-service-head"><div><span class="la-service-kicker">FFXIV PROGRESS</span><h3>ヒカチョク</h3></div><span class="la-service-state ${st.className}">${st.label}</span></div><div class="la-service-metrics"><div><b>${Number(metrics.activeGoals||0)}</b><span>進行中GOAL</span></div><div><b>${Number(metrics.manualRemaining||0)}</b><span>手動進捗の残り</span></div><div><b>${Number(metrics.relicDone||0)} / ${Number(metrics.relicTotal||0)}</b><span>武器工程</span></div></div><div class="la-service-next">${next?`<span>NEXT</span><b>${esc(next.title)}</b>${next.deadline?`<small>${esc(next.deadline)}</small>`:""}`:"<span>NEXT</span><b>進行中のGOALはありません</b>"}</div><div class="la-service-foot"><small>更新：${timeText(summary?.receivedAt||summary?.generatedAt)}</small><div><a class="secondary" href="https://sogetuk14.github.io/hikachoku/?la_view=goals" target="_blank" rel="noopener">GOALを見る</a><a class="primary" href="https://sogetuk14.github.io/hikachoku/" target="_blank" rel="noopener">開く</a></div></div></article>`;
    const syncLabel=summary?.sync?.lastSyncAt?`クラウド最終同期：${timeText(summary.sync.lastSyncAt)}`:summary?.sync?.auto?"クラウド同期：確認中":"SAKU+MERU直接データ";
    return `<article class="la-service-card"><div class="la-service-head"><div><span class="la-service-kicker">TRPG WORKSPACE</span><h3>SAKU+MERU</h3></div><span class="la-service-state ${st.className}">${st.label}</span></div><div class="la-service-metrics"><div><b>${Number(metrics.upcoming||0)}</b><span>これからの予定</span></div><div><b>${Number(metrics.openPrep||0)}</b><span>未完了の卓準備</span></div><div><b>${Number(metrics.scenarios||0)}</b><span>登録シナリオ</span></div></div><div class="la-service-next">${next?`<span>NEXT</span><b>${esc(next.title)}</b>${next.date?`<small>${esc(next.date)}</small>`:""}`:"<span>NEXT</span><b>直近の予定はありません</b>"}</div><div class="la-service-foot"><small>更新：${timeText(summary?.receivedAt||summary?.generatedAt)} ／ ${esc(syncLabel)}</small><div><a class="secondary" href="https://pp-hibithx.github.io/sakumeru/calendar/" target="_blank" rel="noopener">予定を見る</a><button class="primary" type="button" data-open-la-service="sakumeru">LA内で開く</button></div></div></article>`;
  }
  function render(){
    const root=document.getElementById("laServiceCards");if(!root)return;
    root.innerHTML=card("sakumeru",state.sakumeru)+card("hikachoku",state.hikachoku);
    root.querySelector('[data-open-la-service="sakumeru"]')?.addEventListener("click",()=>typeof window.switchView==="function"?window.switchView("sakumeru"):null);
    const note=document.getElementById("laServiceStatusNote");if(note&&!note.textContent)note.textContent="各サービスから受け取った要約です。10分以上更新されない情報は「前回データ」と表示します。";
  }
  function frameFor(service){return document.getElementById(services[service].frame)}
  function request(service,{topLevel=false}={}){
    if(service==="sakumeru"&&topLevel){
      sakumeruSummaryWindow=window.open("https://pp-hibithx.github.io/sakumeru/?la_summary=1","laSakumeruSummary","popup,width=560,height=420");
      return !!sakumeruSummaryWindow;
    }
    const frame=frameFor(service);if(!frame)return;
    if(service==="sakumeru"&&!frame.src)frame.src=frame.dataset.src||"https://pp-hibithx.github.io/sakumeru/";
    try{frame.contentWindow?.postMessage({protocol:PROTOCOL,type:"la:request-summary"},services[service].origin)}catch{}
  }
  function finishRefresh(run){
    if(run!==refreshRun)return;
    refreshRun++;
    const button=document.getElementById("laServiceRefresh"),note=document.getElementById("laServiceStatusNote"),missing=[...pendingServices];
    if(button){button.disabled=false;button.textContent="状況を更新"}
    if(note)note.textContent=missing.length?`更新完了。ただし ${missing.map(x=>x==="sakumeru"?"SAKU+MERU":"ヒカチョク").join("・")} は応答がないため、前回データを表示しています。`:`更新しました（${new Date().toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}）`;
  }
  function requestAll(withFeedback=false){
    if(!withFeedback){Object.keys(services).forEach(request);return}
    const run=++refreshRun,button=document.getElementById("laServiceRefresh"),note=document.getElementById("laServiceStatusNote");
    pendingServices=new Set(Object.keys(services));
    if(button){button.disabled=true;button.textContent="更新中…"}
    if(note)note.textContent="SAKU+MERUとヒカチョクから最新状況を取得しています。";
    request("hikachoku");
    const popupOpened=request("sakumeru",{topLevel:true});
    if(!popupOpened&&note)note.textContent="SAKU+MERUの確認画面を開けませんでした。ポップアップを許可して、もう一度更新してください。";
    setTimeout(()=>finishRefresh(run),4000);
  }
  window.addEventListener("message",event=>{
    const data=event.data,config=services[data?.service];
    if(!config||data?.protocol!==PROTOCOL||data?.type!=="la:service-summary")return;
    const frame=frameFor(data.service),trustedSource=event.source===frame?.contentWindow||(data.service==="sakumeru"&&event.source===sakumeruSummaryWindow);
    if(event.origin!==config.origin||!trustedSource)return;
    state[data.service]={...data,receivedAt:new Date().toISOString()};
    try{localStorage.setItem(CACHE_KEY,JSON.stringify(state))}catch{}
    render();
    if(pendingServices.delete(data.service)&&pendingServices.size===0)finishRefresh(refreshRun);
  });
  function init(){
    render();
    Object.keys(services).forEach(service=>{const frame=frameFor(service);frame?.addEventListener("load",()=>request(service));request(service)});
    document.getElementById("laServiceRefresh")?.addEventListener("click",()=>requestAll(true));
    setInterval(()=>{Object.keys(services).forEach(request);render()},60000);
  }
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init,{once:true}):init();
})();
