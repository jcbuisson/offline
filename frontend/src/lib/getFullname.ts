export default function getFullname(user: { firstname?: string | null; lastname?: string | null; email?: string | null }) {
   return [user.firstname, user.lastname].filter(Boolean).join(' ').trim() || user.email || ''
}
