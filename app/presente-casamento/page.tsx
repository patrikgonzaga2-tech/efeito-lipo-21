import type { Metadata } from 'next'
import Image from 'next/image'
import { Fraunces, Inter } from 'next/font/google'
import { CasamentoPageview, WaCta } from './_cta'

export const metadata: Metadata = {
  title: 'Casamento Corpo Feliz · Você está convidada 💍',
  description:
    'Eu vou casar. E ao invés de pedir presente, eu vou dar a maior condição da história da Comunidade Corpo Feliz. Entre no grupo de convidadas.',
  robots: { index: false, follow: false },
}

// Fontes só desta página (o resto do site usa Bricolage + DM Sans). Ficam em
// variáveis próprias, aplicadas na raiz `.pc` para não vazar para o layout.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-pc-display',
  style: ['normal', 'italic'],
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-pc-body',
  display: 'swap',
})

// CSS da página. Tudo escopado em `.pc` — inclusive o que seria do <body> no
// HTML original — porque aqui o body pertence ao layout do site inteiro.
const CSS = `
.pc{
  --wine:#5A182C;
  --wine-deep:#3F0F1E;
  --champagne:#F8EEE2;
  --cream:#FCF6EC;
  --gold:#C79A4B;
  --gold-soft:#E7CE97;
  --pc-ink:#2B1D1B;
  --pc-ink-soft:#6E5A50;
  --wa:#1FAD54;
  --wa-deep:#178A43;
  --display:var(--font-pc-display),Georgia,serif;
  --body:var(--font-pc-body),system-ui,-apple-system,sans-serif;

  font-family:var(--body);color:var(--pc-ink);background:var(--wine-deep);
  line-height:1.55;-webkit-font-smoothing:antialiased;
}
.pc *{margin:0;padding:0;box-sizing:border-box}
.pc .wrap{max-width:560px;margin:0 auto}

/* ---------- ornamentos ---------- */
.pc .rule{display:flex;align-items:center;justify-content:center;gap:11px;color:var(--gold-soft)}
.pc .rule .line{height:1px;width:50px;background:linear-gradient(90deg,transparent,currentColor);opacity:.75}
.pc .rule .line.r{background:linear-gradient(270deg,transparent,currentColor)}
.pc .rule .gem{width:6px;height:6px;flex:none;background:currentColor;transform:rotate(45deg);
  box-shadow:0 0 0 3px rgba(231,206,151,.16)}
.pc .rule .dia{font-family:var(--display);font-style:italic;font-size:15px;letter-spacing:.03em;color:var(--gold-soft)}

/* ---------- HERO ---------- */
.pc .hero{
  background:
    radial-gradient(120% 80% at 50% -10%, rgba(199,154,75,.22), transparent 60%),
    linear-gradient(180deg,var(--wine) 0%, var(--wine-deep) 100%);
  color:var(--champagne);text-align:center;
  padding:52px 26px 44px;
  animation:pc-fade .8s ease both;
}
.pc .eyebrow{
  font-size:11px;letter-spacing:.34em;text-transform:uppercase;
  color:var(--gold-soft);font-weight:600;margin-bottom:26px;
}
.pc .hero h1{
  font-family:var(--display);font-weight:900;
  font-size:clamp(34px,8.5vw,50px);line-height:1.02;letter-spacing:-.015em;
  margin:22px 0 0;
}
.pc .hero h1 em{font-style:italic;font-weight:500;color:var(--gold-soft)}
.pc .hero .sub{
  margin:20px auto 0;max-width:34ch;font-size:16.5px;color:#F0DFCF;
}
.pc .hero .sub strong{color:#fff;font-weight:600}

/* ---------- RETRATO (moldura em arco) ---------- */
/* A foto do chá é vertical (3:4). Em vez de mostrá-la inteira — o que deixaria
   a moldura alta demais e empurraria o botão para fora da 1ª tela do celular —
   ela é recortada numa janela quadrada (object-fit:cover) enquadrada no alto,
   onde estão o rosto e o bolo "Bride"; a mesa de frutas do rodapé fica de fora. */
/* O tamanho é limitado de propósito: como não há mais botão fixo no rodapé, o
   botão verde do topo é o único CTA da primeira tela — a foto não pode empurrar
   ele para fora dela. */
.pc .portrait{
  width:min(226px,56vw);margin:24px auto 0;padding:5px;
  border-radius:999px 999px 20px 20px;
  background:linear-gradient(160deg,var(--gold-soft),rgba(199,154,75,.45) 52%,var(--gold-soft));
  box-shadow:0 18px 44px rgba(0,0,0,.34);
}
.pc .portrait img{
  display:block;width:100%;height:auto;
  aspect-ratio:1/1;object-fit:cover;object-position:center 14%;
  border-radius:999px 999px 15px 15px;
  border:2px solid rgba(255,255,255,.9);
}

/* ---------- CTA ---------- */
.pc .cta{
  display:flex;align-items:center;justify-content:center;gap:11px;
  background:var(--wa);color:#fff;text-decoration:none;
  font-weight:700;font-size:17px;letter-spacing:.01em;
  padding:18px 24px;border-radius:999px;
  box-shadow:0 10px 26px rgba(31,173,84,.38);
  transition:transform .15s ease, box-shadow .15s ease, background .15s ease;
  width:100%;max-width:420px;margin:28px auto 0;
}
.pc .cta:hover{background:var(--wa-deep);transform:translateY(-2px);box-shadow:0 14px 30px rgba(31,173,84,.46)}
.pc .cta:active{transform:translateY(0)}
.pc .cta svg{width:24px;height:24px;flex:none}
.pc .cta-note{margin-top:12px;font-size:12.5px;color:#E3CDB6;letter-spacing:.02em}

.pc .scarcity{
  margin-top:30px;font-size:13px;color:#EBD6C0;
  border-top:1px solid rgba(231,206,151,.28);padding-top:22px;
  max-width:32ch;margin-inline:auto;
}
.pc .scarcity b{color:var(--gold-soft);font-weight:600}

/* ---------- PRESENTE ---------- */
.pc .presente{background:var(--champagne);padding:46px 26px 40px;text-align:center}
.pc .presente .kick{font-family:var(--display);font-style:italic;color:var(--wine);
  font-size:19px;margin-bottom:12px}
.pc .presente h2{font-family:var(--display);font-weight:600;font-size:clamp(24px,6vw,30px);
  line-height:1.12;color:var(--pc-ink);letter-spacing:-.01em;max-width:20ch;margin:0 auto}
.pc .presente p.lead{margin:16px auto 0;max-width:38ch;font-size:15.5px;color:var(--pc-ink-soft)}

/* ---------- LISTA DE PROMESSAS ---------- */
.pc .promises{max-width:420px;margin:30px auto 0;text-align:left;display:grid;gap:12px}
.pc .promise{display:flex;gap:15px;align-items:center;
  background:#fff;border:1px solid #EDDFCF;border-radius:14px;padding:15px 17px;
  transition:transform .18s ease, box-shadow .18s ease}
.pc .promise:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(90,24,44,.07)}
.pc .promise .ck{flex:none;width:50px;height:50px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  background:linear-gradient(150deg,#FFFDF8 0%,#F4E7D2 100%);
  border:1px solid var(--gold-soft);
  box-shadow:inset 0 0 0 3px #fff, inset 0 0 0 4px rgba(199,154,75,.32), 0 3px 8px rgba(90,24,44,.06);
  color:#A9791F}
.pc .promise .ck svg{width:24px;height:24px;display:block}
.pc .promise span{font-size:15px;color:var(--pc-ink);font-weight:500;line-height:1.4}
.pc .promise b{color:var(--wine);font-weight:700}

/* ---------- FAIXA DE URGÊNCIA ---------- */
.pc .band{background:var(--wine);color:var(--champagne);text-align:center;padding:40px 26px}
.pc .band .big{font-family:var(--display);font-weight:900;font-size:clamp(26px,7vw,38px);
  line-height:1.04;letter-spacing:-.01em}
.pc .band .big em{font-style:italic;font-weight:500;color:var(--gold-soft)}
.pc .band p{margin:14px auto 0;max-width:30ch;font-size:15px;color:#F0DFCF}

/* ---------- FINAL ---------- */
.pc .final{background:var(--wine-deep);color:var(--champagne);text-align:center;padding:44px 26px 50px}
.pc .final h2{font-family:var(--display);font-weight:600;font-size:clamp(24px,6vw,32px);
  line-height:1.1;max-width:18ch;margin:0 auto}
.pc .final .cta{margin-top:26px}

@keyframes pc-fade{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.pc *{animation:none!important;transition:none!important}}

@media (min-width:721px){
  .pc .hero{padding-top:70px}
}
`

export default function Page() {
  return (
    <div className={`pc ${fraunces.variable} ${inter.variable}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <CasamentoPageview />

      {/* ━━ HERO ━━ */}
      <section className="hero">
        <div className="wrap">
          <div className="eyebrow">Casamento Corpo Feliz</div>
          <div className="rule">
            <span className="line" />
            <span className="gem" />
            <span className="dia">27 de julho</span>
            <span className="gem" />
            <span className="line r" />
          </div>
          <h1>
            No meu casamento,<br />quem ganha<br />presente é <em>você</em>.
          </h1>
          <p className="sub">
            Eu vou casar. E ao invés de pedir presente, eu vou <strong>dar</strong> a
            maior condição da história da Comunidade Corpo Feliz. 💍
          </p>

          <div className="portrait">
            <Image
              src="/images/Foto-Cha-Noiva.jpg"
              width={3120}
              height={4160}
              sizes="(min-width:721px) 226px, 56vw"
              alt="Laüra Rosa sorrindo no seu chá de noiva, segurando o bolo escrito Bride"
              priority
            />
          </div>

          <WaCta label="topo">Quero meu convite 💍</WaCta>
          <div className="cta-note">É de graça e leva 10 segundos.</div>

          <p className="scarcity">
            O presente vai ser liberado por <b>poucas horas</b> e somente para{' '}
            <b>quem estiver no grupo de convidadas</b>.
          </p>
        </div>
      </section>

      {/* ━━ PRESENTE ━━ */}
      <section className="presente">
        <div className="wrap">
          <div className="kick">O maior presente que eu já dei</div>
          <h2>Eu só caso uma vez. E essa condição também só existe uma vez.</h2>
          <p className="lead">
            A Comunidade Corpo Feliz é onde vivemos a jornada juntinhas, mulheres reais
            que emagrecem com os treinos hormonais de até 30 minutinhos, em casa, sem
            abrir mão de comer o que gosta. E é isso que eu vou te dar de presente.
          </p>

          <div className="promises">
            <div className="promise">
              <div className="ck">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3.5c.7 5 1.8 6.8 6.8 7.5-5 .7-6.1 2.5-6.8 7.5-.7-5-1.8-6.8-6.8-7.5 5-.7 6.1-2.5 6.8-7.5Z" />
                  <path d="M18.5 3.2c.25 1.7.6 2.3 2.3 2.6-1.7.25-2.05.9-2.3 2.6-.25-1.7-.6-2.35-2.3-2.6 1.7-.3 2.05-.9 2.3-2.6Z" />
                </svg>
              </div>
              <span><b>Braços magros</b> e sem flacidez</span>
            </div>

            <div className="promise">
              <div className="ck">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8.4 4.5h7.2l3 4.5-6.6 10.5L5.4 9Z" />
                  <path d="M5.4 9h13.2" />
                  <path d="M8.4 4.5 10 9l2 10.5L14 9l1.6-4.5" />
                  <path d="M10 9h4" />
                </svg>
              </div>
              <span><b>Barriga seca</b> ainda esse ano</span>
            </div>

            <div className="promise">
              <div className="ck">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3.5h12M6 20.5h12" />
                  <path d="M7.5 3.5c0 5 4.5 6 4.5 8.5s-4.5 3.5-4.5 8.5" />
                  <path d="M16.5 3.5c0 5-4.5 6-4.5 8.5s4.5 3.5 4.5 8.5" />
                  <path d="M9.6 17.6c1-1.4 3.8-1.4 4.8 0" />
                </svg>
              </div>
              <span>Treinos hormonais de <b>até 30min</b>, sem sair de casa</span>
            </div>

            <div className="promise">
              <div className="ck">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20.3S3.8 15 3.8 8.9c0-2.6 2-4.4 4.2-4.4 1.7 0 3.1 1.1 4 2.5.9-1.4 2.3-2.5 4-2.5 2.2 0 4.2 1.8 4.2 4.4 0 6.1-8.2 11.4-8.2 11.4Z" />
                </svg>
              </div>
              <span>Comendo o que gosta, plano alimentar flexível, <b>sem dieta restritiva</b></span>
            </div>
          </div>
        </div>
      </section>

      {/* ━━ FAIXA DE URGÊNCIA ━━ */}
      <section className="band">
        <div className="wrap">
          <div className="big">27 de julho.<br /><em>Um único dia.</em></div>
          <p>Depois do meu casamento, essa condição não volta. Eu não caso de novo.</p>
        </div>
      </section>

      {/* ━━ CTA FINAL ━━ */}
      <section className="final">
        <div className="wrap">
          <h2>Vem casar comigo. O presente já está te esperando.</h2>
          <WaCta label="final">Entrar no grupo de convidadas</WaCta>
          <div className="cta-note">Grupo fechado · você recebe o presente em primeira mão</div>
        </div>
      </section>

    </div>
  )
}
