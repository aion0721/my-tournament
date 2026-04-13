import { useMemo, useState } from 'react'
import type { CreateEventInput } from '../domain/models'
import { validateCreateEventInput } from '../domain/tournament'

interface EventCreateFormProps {
  disabled: boolean
  onSubmit: (input: CreateEventInput) => void
}

const defaultInput: CreateEventInput = {
  name: '',
  capacity: 16,
  participantsPerBlock: 4,
  winnersPerBlock: 1,
}

export function EventCreateForm({ disabled, onSubmit }: EventCreateFormProps) {
  const [form, setForm] = useState<CreateEventInput>(defaultInput)
  const validation = useMemo(() => validateCreateEventInput(form), [form])

  return (
    <section className="section-card stack">
      <div>
        <div className="section-title">イベント作成</div>
        <p className="muted">
          入力値からブロック数を自動計算し、ブロック戦と決勝トーナメントを生成します。
        </p>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="event-name">イベント名</label>
          <input
            id="event-name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="春季シングルス大会"
          />
        </div>
        <div className="field">
          <label htmlFor="capacity">参加人数</label>
          <input
            id="capacity"
            type="number"
            min={2}
            value={form.capacity}
            onChange={(event) =>
              setForm({ ...form, capacity: Number(event.target.value) || 0 })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="participants-per-block">1ブロックあたりの人数</label>
          <input
            id="participants-per-block"
            type="number"
            min={2}
            value={form.participantsPerBlock}
            onChange={(event) =>
              setForm({
                ...form,
                participantsPerBlock: Number(event.target.value) || 0,
              })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="winners-per-block">各ブロックからの勝ち上がり人数</label>
          <input
            id="winners-per-block"
            type="number"
            min={1}
            value={form.winnersPerBlock}
            onChange={(event) =>
              setForm({ ...form, winnersPerBlock: Number(event.target.value) || 0 })
            }
          />
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">ブロック数</div>
          <div className="stat-value">{validation.blockCount || '-'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">決勝進出人数</div>
          <div className="stat-value">
            {validation.blockCount > 0 ? validation.blockCount * form.winnersPerBlock : '-'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">現在の制約</div>
          <div className="stat-value">MVP</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">保存先</div>
          <div className="stat-value">local</div>
        </div>
      </div>

      {validation.issues.length > 0 ? (
        <div className="notice">
          {validation.issues.map((issue) => (
            <div key={issue}>{issue}</div>
          ))}
        </div>
      ) : (
        <div className="notice success">
          作成可能です。イベント作成後に参加URLが発行されます。
        </div>
      )}

      <div className="button-row">
        <button
          className="button"
          type="button"
          disabled={disabled || !validation.valid}
          onClick={() => onSubmit(form)}
        >
          イベントを作成
        </button>
      </div>
    </section>
  )
}
