import { useState } from 'react'

interface ParticipantNameEditorProps {
  initialName: string
  inputId: string
  onSubmit: (name: string) => Promise<void>
}

export function ParticipantNameEditor({
  initialName,
  inputId,
  onSubmit,
}: ParticipantNameEditorProps) {
  const [name, setName] = useState(initialName)

  return (
    <div className="field">
      <label htmlFor={inputId}>表示中の参加者名</label>
      <div className="button-row">
        <input
          id={inputId}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="参加者名"
        />
        <button
          className="button-secondary"
          type="button"
          onClick={() => void onSubmit(name)}
        >
          名前変更
        </button>
      </div>
    </div>
  )
}
