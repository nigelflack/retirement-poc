import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

function validatePeopleFile(data) {
  if (!data || !Array.isArray(data.people) || data.people.length === 0) return false
  return data.people.every(p =>
    typeof p.name === 'string' && p.name.trim() &&
    typeof p.currentAge === 'number' &&
    Array.isArray(p.accounts) && p.accounts.length > 0,
  )
}

export default function PersonDetails({ onComplete, initialPeople = [], onPeopleLoad }) {
  const [name, setName] = useState(initialPeople[0]?.name ?? '')
  const [age, setAge] = useState(initialPeople[0]?.currentAge?.toString() ?? '')
  const [includePartner, setIncludePartner] = useState(initialPeople.length > 1)
  const [partnerName, setPartnerName] = useState(initialPeople[1]?.name ?? '')
  const [partnerAge, setPartnerAge] = useState(initialPeople[1]?.currentAge?.toString() ?? '')
  const [errors, setErrors] = useState({})
  const [loadError, setLoadError] = useState(null)
  const fileInputRef = useRef(null)

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

  function handleLoadClick() {
    setLoadError(null)
    fileInputRef.current?.click()
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (!validatePeopleFile(data)) {
          setLoadError('Could not load file — invalid format.')
          return
        }
        onPeopleLoad(data.people)
      } catch {
        setLoadError('Could not load file — invalid format.')
      }
      e.target.value = ''
    }
    reader.readAsText(file)
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

        <div className="space-y-2">
          <Button variant="outline" onClick={handleLoadClick} className="w-full">
            Load from file
          </Button>
          {loadError && <p className="text-sm text-destructive">{loadError}</p>}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <p className="text-sm text-center">
          <Link to="/scenarios" className="text-primary underline-offset-4 hover:underline">
            View example scenarios →
          </Link>
        </p>
      </div>
    </div>
  )
}
