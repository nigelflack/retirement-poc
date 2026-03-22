import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

export default function PersonDetails({ onComplete }) {
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [includePartner, setIncludePartner] = useState(false)
  const [partnerName, setPartnerName] = useState('')
  const [partnerAge, setPartnerAge] = useState('')
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!name.trim()) e.name = 'Name is required'
    const ageNum = parseInt(age, 10)
    if (!age || isNaN(ageNum) || ageNum < 18 || ageNum > 80) e.age = 'Age must be between 18 and 80'
    if (includePartner) {
      if (!partnerName.trim()) e.partnerName = 'Partner name is required'
      const pAge = parseInt(partnerAge, 10)
      if (!partnerAge || isNaN(pAge) || pAge < 18 || pAge > 80) e.partnerAge = 'Age must be between 18 and 80'
    }
    return e
  }

  function handleContinue() {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    const people = [{ name: name.trim(), currentAge: parseInt(age, 10) }]
    if (includePartner) {
      people.push({ name: partnerName.trim(), currentAge: parseInt(partnerAge, 10) })
    }
    onComplete(people)
  }

  function handleTogglePartner(checked) {
    setIncludePartner(checked)
    if (!checked) {
      setPartnerName('')
      setPartnerAge('')
      setErrors(e => { const { partnerName: _pn, partnerAge: _pa, ...rest } = e; return rest })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Let&apos;s get started</h1>

        <div className="space-y-2">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            placeholder="e.g. Bob"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="age">Your age today</Label>
          <Input
            id="age"
            type="number"
            placeholder="e.g. 50"
            min={18}
            max={80}
            value={age}
            onChange={e => setAge(e.target.value)}
            className="w-28"
          />
          {errors.age && <p className="text-sm text-destructive">{errors.age}</p>}
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="includePartner"
            checked={includePartner}
            onCheckedChange={handleTogglePartner}
          />
          <Label htmlFor="includePartner" className="cursor-pointer">Include my partner</Label>
        </div>

        {includePartner && (
          <div className="border rounded-lg p-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="partnerName">Partner&apos;s name</Label>
              <Input
                id="partnerName"
                placeholder="e.g. Alice"
                value={partnerName}
                onChange={e => setPartnerName(e.target.value)}
              />
              {errors.partnerName && <p className="text-sm text-destructive">{errors.partnerName}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="partnerAge">Their age today</Label>
              <Input
                id="partnerAge"
                type="number"
                placeholder="e.g. 45"
                min={18}
                max={80}
                value={partnerAge}
                onChange={e => setPartnerAge(e.target.value)}
                className="w-28"
              />
              {errors.partnerAge && <p className="text-sm text-destructive">{errors.partnerAge}</p>}
            </div>
          </div>
        )}

        <Button onClick={handleContinue} className="w-full">Continue</Button>
      </div>
    </div>
  )
}
