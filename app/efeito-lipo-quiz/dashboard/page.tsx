import { redirect } from 'next/navigation'

// O endereço antigo agora leva ao novo lar: o Painel da Marca (Hotmart + Greenn).
// As páginas da seção Efeito Lipo seguem acessíveis pela navegação do painel.
export default function DashboardIndex() {
  redirect('/painel')
}
