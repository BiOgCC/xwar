import { useState, useEffect } from 'react'
import type { EquipSlot } from '../../stores/inventoryStore'
import ProfileSpecBars from './profile/ProfileSpecBars'
import ProfileStatsGrid from './profile/ProfileStatsGrid'
import ProfileGearSection from './profile/ProfileGearSection'
import ProfileResources from './profile/ProfileResources'
import { SlotPickerModal, AmmoPickerModal, AvatarPickerModal } from './profile/ProfileModals'

export default function ProfileTab() {
  const [pickerSlot, setPickerSlot] = useState<EquipSlot | null>(null)
  const [showAmmoPicker, setShowAmmoPicker] = useState(false)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)

  // ESC closes any open modal
  useEffect(() => {
    const onClose = () => { setPickerSlot(null); setShowAmmoPicker(false); setShowAvatarPicker(false) }
    window.addEventListener('xwar-close-modal', onClose)
    return () => window.removeEventListener('xwar-close-modal', onClose)
  }, [])

  return (
    <div className="ptab">
      <ProfileSpecBars />
      <ProfileStatsGrid />
      <ProfileGearSection
        onPickSlot={setPickerSlot}
        onPickAmmo={() => setShowAmmoPicker(true)}
      />
      <ProfileResources />

      {/* Modals */}
      {pickerSlot && <SlotPickerModal slot={pickerSlot} onClose={() => setPickerSlot(null)} />}
      {showAmmoPicker && <AmmoPickerModal onClose={() => setShowAmmoPicker(false)} />}
      {showAvatarPicker && <AvatarPickerModal onClose={() => setShowAvatarPicker(false)} />}
    </div>
  )
}
