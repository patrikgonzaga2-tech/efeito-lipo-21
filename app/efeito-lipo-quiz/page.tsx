import Script from 'next/script'
import QuizApp from './_quiz'

export const metadata = {
  title: 'Avaliação gratuita — Efeito Lipo 21',
  description:
    'Faça a avaliação gratuita e descubra como ativar o Efeito Lipo e queimar até 8kg em 21 dias — sem academia e sem canetinhas caras.',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    title: 'Avaliação gratuita — Efeito Lipo 21',
    description: 'Descubra o que está travando o seu corpo em menos de 3 minutos.',
  },
}

// Pageview do topo do funil, ALINHADO ao Meta: só conta quando a página fica
// visível pra pessoa por DWELL ms SEGUIDOS. Isso descarta (a) os pré-
// carregamentos do Instagram, que rodam ocultos e nunca acumulam tempo
// visível, e (b) as saídas instantâneas (<DWELL) — que é, na prática, o que o
// pixel lento do Meta acaba exigindo. Assim a "Visualização" do dashboard
// reconcilia com a "Visualização da página de destino" do Meta. A gravação é
// insert-ignore no servidor: se a pessoa clicar em "começar" antes do DWELL,
// NÃO rebaixa o status. DWELL é ajustável — medir e calibrar pra bater ~Meta.
const PAGEVIEW_BEACON = `(function(){try{
  if(window.__elqpv)return;window.__elqpv=1;
  var DWELL=3000,t=null,done=false;
  function send(){
    if(done)return;done=true;
    try{
      var K='el_quiz_sid',sid=sessionStorage.getItem(K);
      if(!sid){sid=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now()+'-'+Math.random().toString(16).slice(2));sessionStorage.setItem(K,sid);}
      var p=new URLSearchParams(location.search),g=function(k){return p.get(k)||undefined;};
      var ABK='el_intro_ab',fab=p.get('ab'),ab=(fab==='A'||fab==='B')?fab:sessionStorage.getItem(ABK);
      if(ab!=='A'&&ab!=='B'){ab=Math.random()<0.5?'A':'B';}
      sessionStorage.setItem(ABK,ab);
      fetch('/api/quiz',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({
        id:sid,action:'pageview',variante:g('variante'),intro_ab:ab,
        utm_source:g('utm_source'),utm_medium:g('utm_medium'),utm_campaign:g('utm_campaign'),
        utm_content:g('utm_content'),utm_term:g('utm_term'),sck:g('sck'),
        referrer:document.referrer||undefined,user_agent:navigator.userAgent
      })}).catch(function(){});
    }catch(e){}
  }
  function tick(){
    if(done)return;
    if(document.visibilityState==='visible'){ if(t===null)t=setTimeout(function(){t=null;send();},DWELL); }
    else if(t!==null){ clearTimeout(t); t=null; }
  }
  document.addEventListener('visibilitychange',tick);
  tick();
}catch(e){}})();`

export default function Page() {
  return (
    <>
      <Script id="el-pageview-beacon" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: PAGEVIEW_BEACON }} />
      <QuizApp />
    </>
  )
}
