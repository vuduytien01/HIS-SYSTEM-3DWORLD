// Kho sự kiện append-only — nguồn sự thật duy nhất (spec). Chỉ ghi thêm, không ai sửa/xóa.
// recordEvent nhận tx (Prisma transaction client) để sự kiện và thay đổi state nằm cùng transaction.
export function recordEvent(tx, { type, aggregateId, payload, actorType, actorUserId = null, actorLabel }) {
  return tx.event.create({
    data: {
      type,
      aggregateId,
      payload: JSON.stringify(payload ?? {}),
      actorType,
      actorUserId,
      actorLabel,
    },
  });
}
