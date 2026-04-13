import { useState } from 'react'
import type { Participant } from '../domain/models'

interface ParticipantListProps {
  participants: Participant[]
  canEdit?: boolean
  maxBlockCount?: number
  maxSeed?: number
  onUpdateAssignment?: (
    participantId: string,
    assignedBlockIndex: number,
    assignedSeed: number,
  ) => Promise<void>
  onUpdateName?: (participantId: string, name: string) => Promise<void>
  onDeleteParticipant?: (participant: Participant) => Promise<void>
}

export function ParticipantList({
  participants,
  canEdit = false,
  maxBlockCount = 0,
  maxSeed = 0,
  onUpdateAssignment,
  onUpdateName,
  onDeleteParticipant,
}: ParticipantListProps) {
  const [drafts, setDrafts] = useState<
    Record<string, { name: string; blockIndex: number; seed: number }>
  >({})

  return (
    <section className="section-card stack">
      <div>
        <div className="section-title">参加者一覧</div>
        <p className="muted">
          {canEdit
            ? 'ホストはここで参加者名、ブロック、シード、削除を更新できます。'
            : '参加済みメンバーの現在の割り当てを表示します。'}
        </p>
      </div>
      {participants.length === 0 ? (
        <div className="empty-state">まだ参加者はいません。</div>
      ) : (
        <div className="list">
          {participants
            .slice()
            .sort((left, right) => left.joinedAt.localeCompare(right.joinedAt))
            .map((participant) => {
              const draft = drafts[participant.id] ?? {
                name: participant.name,
                blockIndex: participant.assignedBlockIndex,
                seed: participant.assignedSeed,
              }

              return (
                <div className="participant-row" key={participant.id}>
                  <div className="stack" style={{ minWidth: 220 }}>
                    {canEdit ? (
                      <div className="button-row">
                        <input
                          value={draft.name}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [participant.id]: {
                                ...draft,
                                name: event.target.value,
                              },
                            }))
                          }
                          style={{ minWidth: 180 }}
                        />
                        <button
                          className="button-secondary"
                          type="button"
                          onClick={() => void onUpdateName?.(participant.id, draft.name)}
                        >
                          名前変更
                        </button>
                      </div>
                    ) : (
                      <strong>{participant.name}</strong>
                    )}
                    <div className="muted">
                      Block {participant.assignedBlockIndex + 1} / Seed {participant.assignedSeed}
                    </div>
                  </div>
                  {canEdit ? (
                    <div className="button-row">
                      <input
                        type="number"
                        min={1}
                        max={maxBlockCount}
                        value={draft.blockIndex + 1}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [participant.id]: {
                              ...draft,
                              blockIndex: Math.max(0, Number(event.target.value) - 1),
                            },
                          }))
                        }
                        style={{ width: 84 }}
                      />
                      <input
                        type="number"
                        min={1}
                        max={maxSeed}
                        value={draft.seed}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [participant.id]: {
                              ...draft,
                              seed: Number(event.target.value),
                            },
                          }))
                        }
                        style={{ width: 84 }}
                      />
                      <button
                        className="button-secondary"
                        type="button"
                        onClick={() =>
                          void onUpdateAssignment?.(
                            participant.id,
                            draft.blockIndex,
                            draft.seed,
                          )
                        }
                      >
                        配置変更
                      </button>
                      <button
                        className="button-secondary"
                        type="button"
                        onClick={() => void onDeleteParticipant?.(participant)}
                      >
                        削除
                      </button>
                    </div>
                  ) : (
                    <div className="badge">Seed {participant.assignedSeed}</div>
                  )}
                </div>
              )
            })}
        </div>
      )}
    </section>
  )
}
