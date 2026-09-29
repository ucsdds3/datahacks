import '@/themes/minecraft/minecraft.css'
import '@/themes/minecraft/descent.css'
import { ReactNode } from 'react'

export default function MinecraftLayout({ children }: { children: ReactNode }) {
  return <div className="minecraft-root">{children}</div>
}