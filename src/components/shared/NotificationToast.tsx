import { useEffect, useState, useCallback } from 'react'
import { useUIStore, type Notification } from '../../stores/uiStore'
import '../../styles/notifications.css'

const ICONS: Record<Notification['type'], string> = {
  success: '✓',
  danger: '✕',
  warning: '⚠',
  info: 'ℹ',
}

const AUTO_DISMISS_MS = 5000

function Toast({ notification, onDismiss }: { notification: Notification; onDismiss: (id: string) => void }) {
  const [removing, setRemoving] = useState(false)

  const dismiss = useCallback(() => {
    setRemoving(true)
    setTimeout(() => onDismiss(notification.id), 300) // match slide-out duration
  }, [notification.id, onDismiss])

  useEffect(() => {
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [dismiss])

  return (
    <div
      className={`toast toast--${notification.type} ${removing ? 'toast--removing' : ''}`}
      onClick={dismiss}
      role="alert"
    >
      <span className="toast__icon">{ICONS[notification.type]}</span>
      <span className="toast__message">{notification.message}</span>
      <button className="toast__close" onClick={(e) => { e.stopPropagation(); dismiss() }}>×</button>
      <div className="toast__progress" />
    </div>
  )
}

export default function NotificationToast() {
  const notifications = useUIStore((s) => s.notifications)
  const removeNotification = useUIStore((s) => s.removeNotification)

  // Only show the last 5
  const visible = notifications.slice(-5)

  if (visible.length === 0) return null

  return (
    <div className="toast-container">
      {visible.map((n) => (
        <Toast key={n.id} notification={n} onDismiss={removeNotification} />
      ))}
    </div>
  )
}
