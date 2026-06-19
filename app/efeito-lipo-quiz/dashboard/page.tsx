import { redirect } from 'next/navigation'

// O dashboard abre direto na aba Funil.
export default function DashboardIndex() {
  redirect('/efeito-lipo-quiz/dashboard/funil')
}
