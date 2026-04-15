import { useState } from 'react'
import type { EventInvite, EventInviteType, EventRecord } from '../domain/models'

interface InviteManagementCardProps {
  eventRecord: EventRecord
  canEdit: boolean
  onCreateInvite: (
    displayName: string,
    inviteType: EventInviteType,
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
  const [inviteType, setInviteType] = useState<EventInviteType>('private')
  const [fixedBlockIndex, setFixedBlockIndex] = useState('')
  const [fixedSeed, setFixedSeed] = useState('')

  const buildInviteUrl = (invite: EventInvite) =>
    `${window.location.origin}/invite/${invite.inviteToken}`

  return (
    <section className="section-card stack">
      <div>
        <div className="section-title">招待参加 / 事前登録</div>
        <p className="muted">
          専用URLで参加させる通常招待と、通常参加URLで名前クリックさせる事前登録を使い分けられます。
        </p>
      </div>

      {canEdit ? (
        <>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="invite-display-name">参加者名</label>
              <input
                id="invite-display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="例: 田中 太郎"
              />
            </div>
            <div className="field">
              <label htmlFor="invite-type">登録方法</label>
              <select
                id="invite-type"
                value={inviteType}
                onChange={(event) => setInviteType(event.target.value as EventInviteType)}
              >
                <option value="private">通常招待</option>
                <option value="preset">事前登録参加者</option>
              </select>
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
                  inviteType,
                  fixedBlockIndex ? Number(fixedBlockIndex) - 1 : null,
                  fixedSeed ? Number(fixedSeed) : null,
                ).then(() => {
                  setDisplayName('')
                  setInviteType('private')
                  setFixedBlockIndex('')
                  setFixedSeed('')
                })
              }
            >
              {inviteType === 'preset' ? '事前登録する' : '招待URLを発行'}
            </button>
          </div>
        </>
      ) : null}

      {eventRecord.invites.length === 0 ? (
        <div className="empty-state">まだ参加者は登録されていません。</div>
      ) : (
        <div className="list">
          {eventRecord.invites.map((invite) => (
            <div className="participant-row" key={invite.id}>
              <div>
                <strong>{invite.displayName}</strong>
                <div className="muted">
                  {invite.inviteType === 'preset' ? '事前登録参加者' : '通常招待'}
                  {' / '}
                  {invite.fixedBlockIndex !== null && invite.fixedSeed !== null
                    ? `固定枠: Block ${invite.fixedBlockIndex + 1} / Seed ${invite.fixedSeed}`
                    : '枠は参加時に確定'}
                </div>
                {invite.inviteType === 'private' ? (
                  <div className="mono muted">{buildInviteUrl(invite)}</div>
                ) : (
                  <div className="muted">通常参加URLから名前クリックで参加します。</div>
                )}
              </div>
              <div className="button-row">
                <span className="badge">{invite.status === 'joined' ? 'Joined' : 'Pending'}</span>
                <span className="badge">
                  {invite.inviteType === 'preset' ? 'Preset' : 'Private'}
                </span>
                {invite.inviteType === 'private' ? (
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(buildInviteUrl(invite))
                    }}
                  >
                    URLをコピー
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
