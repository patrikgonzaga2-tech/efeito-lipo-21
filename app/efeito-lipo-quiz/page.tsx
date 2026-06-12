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

// Pageview do topo do funil: grava assim que a página fica VISÍVEL pra
// pessoa — antes de o app do quiz baixar/hidratar, mas só quando é um view
// humano de verdade. O gate de visibilidade ignora os pré-carregamentos /
// prerender que o Instagram roda escondido (que estouravam a contagem
// acima dos cliques). Alinha o dashboard com a "Visualização da página de
// destino" do Meta. A mesma sessão (el_quiz_sid) é reaproveitada pelo app;
// o upsert torna idempotente.
const PAGEVIEW_BEACON = `(function(){try{
  if(window.__elqpv)return;window.__elqpv=1;
  var sent=false;
  function send(){
    if(sent)return;sent=true;
    try{
      var K='el_quiz_sid',sid=sessionStorage.getItem(K);
      if(!sid){sid=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now()+'-'+Math.random().toString(16).slice(2));sessionStorage.setItem(K,sid);}
      var p=new URLSearchParams(location.search),g=function(k){return p.get(k)||undefined;};
      fetch('/api/quiz',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({
        id:sid,action:'pageview',variante:g('variante'),
        utm_source:g('utm_source'),utm_medium:g('utm_medium'),utm_campaign:g('utm_campaign'),
        utm_content:g('utm_content'),utm_term:g('utm_term'),sck:g('sck'),
        referrer:document.referrer||undefined,user_agent:navigator.userAgent
      })}).catch(function(){});
    }catch(e){}
  }
  if(document.visibilityState==='visible'){send();}
  else{document.addEventListener('visibilitychange',function on(){
    if(document.visibilityState==='visible'){document.removeEventListener('visibilitychange',on);send();}
  });}
}catch(e){}})();`

export default function Page() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PAGEVIEW_BEACON }} />
      <QuizApp />
    </>
  )
}
