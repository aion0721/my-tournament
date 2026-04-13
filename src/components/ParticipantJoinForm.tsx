import { useState } from 'react'

interface ParticipantJoinFormProps {
  isFull: boolean
  hasJoined: boolean
  onJoin: (name: string) => void
}

export function ParticipantJoinForm({
  isFull,
  hasJoined,
  onJoin,
}: ParticipantJoinFormProps) {
  const [name, setName] = useState('')

  return (
    <section className="section-card stack">
      <div>
        <div className="section-title">参加登録</div>
        <p className="muted">
          名前を入力すると、空き枠へランダムでブロックとシードが割り当てられます。
        </p>
      </div>
      {hasJoined ? (
        <div className="notice success">このブラウザではすでに参加済みです。</div>
      ) : isFull ? (
        <div className="notice">このイベントは満員のため参加できません。</div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="participant-name">参加者名</label>
            <input
              id="participant-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例: 佐藤"
            />
          </div>
          <div className="button-row">
            <button className="button" type="button" onClick={() => onJoin(name)}>
              このイベントに参加
            </button>
          </div>
        </>
      )}
    </section>
  )
}
