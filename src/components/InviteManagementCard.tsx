import { useState } from 'react'
import type { EventInvite, EventRecord } from '../domain/models'

interface InviteManagementCardProps {
  eventRecord: EventRecord
  canEdit: boolean
  onCreateInvite: (
    displayName: string,
    fixedBlockIndex: number | null,
    fixedSeed: number | null,
  ) => Promise<void>
}

export function InviteManagementCard({
  eventRecord,
  canEdit,
  onCreateInvite,
}: InviteManagementCardProps) {
  const [displayName, setDisplayName] = useState('')
  const [fixedBlockIndex, setFixedBlockIndex] = useState('')
  const [fixedSeed, setFixedSeed] = useState('')

  const buildInviteUrl = (invite: EventInvite) =>
    `${window.location.origin}/invite/${invite.inviteToken}`

  return (
    <section className="section-card stack">
      <div>
        <div className="section-title">招待参加</div>
        <p className="muted">
          主催者が事前に参加者を登録し、専用URLから参加してもらう導線です。固定枠は任意です。
        </p>
      </div>

      {canEdit ? (
        <>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="invite-display-name">招待する名前</label>
              <input
                id="invite-display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="例: 田中 太郎"
              />
            </div>
            <div className="field">
              <label htmlFor="invite-block">固定ブロック任意</label>
              <input
                id="invite-block"
                type="number"
                min={1}
                max={eventRecord.event.blockCount}
                value={fixedBlockIndex}
                onChange={(event) => setFixedBlockIndex(event.target.value)}
                placeholder="未指定なら空欄"
              />
            </div>
            <div className="field">
              <label htmlFor="invite-seed">固定シード任意</label>
              <input
                id="invite-seed"
                type="number"
                min={1}
                max={eventRecord.event.participantsPerBlock}
                value={fixedSeed}
                onChange={(event) => setFixedSeed(event.target.value)}
                placeholder="未指定なら空欄"
              />
            </div>
          </div>
          <div className="button-row">
            <button
              className="button"
              type="button"
              onClick={() =>
                void onCreateInvite(
                  displayName,
                  fixedBlockIndex ? Number(fixedBlockIndex) - 1 : null,
                  fixedSeed ? Number(fixedSeed) : null,
                ).then(() => {
                  setDisplayName('')
                  setFixedBlockIndex('')
                  setFixedSeed('')
                })
              }
            >
              招待URLを発行
            </button>
          </div>
        </>
      ) : null}

      {eventRecord.invites.length === 0 ? (
        <div className="empty-state">まだ招待参加者は登録されていません。</div>
      ) : (
        <div className="list">
          {eventRecord.invites.map((invite) => (
            <div className="participant-row" key={invite.id}>
              <div>
                <strong>{invite.displayName}</strong>
                <div className="muted">
                  {invite.fixedBlockIndex !== null && invite.fixedSeed !== null
                    ? `固定枠: Block ${invite.fixedBlockIndex + 1} / Seed ${invite.fixedSeed}`
                    : '枠は参加時に確定'}
                </div>
                <div className="mono muted">{buildInviteUrl(invite)}</div>
              </div>
              <div className="button-row">
                <span className="badge">{invite.status === 'joined' ? 'Joined' : 'Pending'}</span>
                <button
                  className="button-secondary"
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(buildInviteUrl(invite))
                  }}
                >
                  URLをコピー
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
