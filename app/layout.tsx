import type { Metadata } from 'next'
import { Bricolage_Grotesque, DM_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import Script from 'next/script'
import './globals.css'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '700', '800'],
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Efeito Lipo 21 — Laüra Rosa',
  description:
    'Em apenas 21 dias, perca até 8KG secando a barriga e afinando os braços em casa — sem academia e sem canetinhas caras.',
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    title: 'Efeito Lipo 21 — Laüra Rosa',
    description:
      'Em apenas 21 dias, perca até 8KG secando a barriga e afinando os braços em casa.',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${bricolage.variable} ${dmSans.variable}`}
      suppressHydrationWarning
    >
      <body
        className="font-sans antialiased"
        style={{ fontFamily: 'var(--font-body, DM Sans, sans-serif)' }}
        suppressHydrationWarning
      >
        {/* Google Tag Manager — carregado de forma ADIADA (~2,5s OU no primeiro
            gesto do usuário, o que vier antes) para não competir com a
            renderização da 1ª tela em celulares fracos. O GTM (e tudo que ele
            dispara: GA4, Pixel do Facebook, Clarity, CAPI) sai do caminho
            crítico. Nada de rastreio é perdido: os eventos do quiz são
            empilhados no dataLayer e processados assim que o GTM carrega; e a
            "Visualização" do dashboard tem beacon próprio no servidor (page.tsx),
            independente do GTM. */}
        <Script id="gtm-deferred" strategy="afterInteractive">{`
          (function(w,d){
            if(w.__gtmInit)return;w.__gtmInit=1;
            w.dataLayer=w.dataLayer||[];
            var evts=['scroll','pointerdown','touchstart','keydown','mousemove'],t=null,loaded=false;
            function cleanup(){if(t){clearTimeout(t);t=null;}evts.forEach(function(e){w.removeEventListener(e,load);});}
            function load(){
              if(loaded)return;loaded=true;cleanup();
              (function(w,d,s,l,i){w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(w,d,'script','dataLayer','GTM-KFQ56MZ7');
            }
            t=setTimeout(load,2500);
            evts.forEach(function(e){w.addEventListener(e,load,{once:true,passive:true});});
          })(window,document);
        `}</Script>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-KFQ56MZ7"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {/* End Google Tag Manager */}
        {children}
        <Analytics />
        {/* Script de rastreio UTM — roda somente quando a página está ociosa */}
        <Script id="utm-tracker" strategy="lazyOnload">{`
          console.log('%cScript de rastreio by Comunidade Nova Ordem do Digital - Dericson Calari e Samuel Choairy', 'color: purple; font-size: 20px;');
          (function () {
            let parametros = ["utm_source"];
            const url = new URL(window.location.href);
            const params = new URLSearchParams(url.search);
            for (const [key] of params) {
              if (!parametros.includes(key)) parametros.push(key);
            }
            const urlParamsCapt = new URLSearchParams(window.location.search);
            const urlParamsCaptReferrer = new URLSearchParams(document.referrer.split('?')[1] || '');
            let utms = {};
            parametros.forEach(el => {
              if (el === "utm_source") {
                utms[el] = urlParamsCapt.get(el) ?? (document.referrer ? (urlParamsCaptReferrer.get(el) ?? new URL(document.referrer).hostname) : "direto");
              } else {
                utms[el] = urlParamsCapt.get(el) ?? (urlParamsCaptReferrer.get(el) ?? "");
              }
            });
            let scks = Object.values(utms).filter(value => value !== "");
            let currentSckValues = [];
            if (urlParamsCapt.get('sck')) currentSckValues = urlParamsCapt.get('sck').split('|');
            scks = scks.filter(value => !currentSckValues.includes(value));
            const updateLinks = (el, elURL) => {
              const elSearchParams = new URLSearchParams(elURL.search);
              let modified = false;
              for (let key in utms) {
                if (!elSearchParams.has(key)) { elSearchParams.append(key, utms[key]); modified = true; }
              }
              if (!elSearchParams.has('sck') && scks.length > 0) { elSearchParams.append('sck', scks.join('|')); modified = true; }
              if (modified) return elURL.origin + elURL.pathname + "?" + elSearchParams.toString();
              return el.href;
            };
            document.querySelectorAll('a').forEach(el => {
              const elURL = new URL(el.href);
              if (!elURL.hash) el.href = updateLinks(el, elURL);
            });
            document.querySelectorAll('iframe').forEach(iframe => {
              let actualSrc = iframe.hasAttribute('data-src') ? iframe.getAttribute('data-src') : iframe.src;
              if (actualSrc) {
                const iframeURL = new URL(actualSrc);
                if (iframe.hasAttribute('data-src')) iframe.setAttribute('data-src', updateLinks(iframe, iframeURL));
                else iframe.src = updateLinks(iframe, iframeURL);
              }
            });
          })();
        `}</Script>
      </body>
    </html>
  )
}
