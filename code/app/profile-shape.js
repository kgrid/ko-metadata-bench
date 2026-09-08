const normalizedType = (definition) => Array.isArray(definition?.type) ? [...definition.type].map(String).sort().join("|") : String(definition?.type ?? "unknown");

const profileShapeFacts = (profile) => {
  const definitions = Object.values(profile?.properties ?? {});
  const types = definitions.map(normalizedType);
  return {
    propertyCount: definitions.length,
    requiredCount: profile?.required?.length ?? 0,
    collectionCount: types.filter((type) => type.includes("array") || type.includes("object")).length,
    scalarCount: types.filter((type) => !type.includes("array") && !type.includes("object")).length,
    constrainedCount: definitions.filter((definition) => definition?.enum || definition?.items || definition?.format || definition?.minimum != null || definition?.maximum != null).length,
  };
};

export function profileShapeSignature(profile) {
  const properties = Object.entries(profile?.properties ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, definition]) => `${name}:${normalizedType(definition)}`);
  return [
    String(profile?.profile ?? "unnamed-profile"),
    String(profile?.semanticType ?? "object"),
    [...(profile?.required ?? [])].map(String).sort().join(","),
    properties.join(","),
  ].join("|");
}

export function profileShapeHash(signature) {
  let hash = 2166136261;
  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function profileShapeModel(profile) {
  const signature = profileShapeSignature(profile);
  const hash = profileShapeHash(signature);
  const facts = profileShapeFacts(profile);
  const family = (facts.propertyCount + facts.requiredCount + facts.collectionCount * 2 + facts.constrainedCount * 3) & 3;
  const top = 6 + (family & 1) * 6;
  const right = 114 - ((family >>> 1) & 1) * 12;
  const bottom = 82 - (family & 1) * 6;
  const left = 6 + ((family >>> 1) & 1) * 12;
  const corner = 8 + family * 2;
  const topX = 27 + (hash & 15);
  const topWidth = 18 + ((hash >>> 4) & 7);
  const topDepth = 8 + Math.min(5, facts.collectionCount * 2 + ((hash >>> 7) & 3));
  const topFeatureY = (hash >>> 9) & 1 ? Math.max(2, top - topDepth) : top + topDepth;
  const rightY = 26 + ((hash >>> 10) & 15);
  const rightHeight = 18 + ((hash >>> 14) & 7);
  const rightDepth = 8 + Math.min(6, facts.constrainedCount + ((hash >>> 17) & 3));
  const rightFeatureX = (hash >>> 19) & 1 ? Math.min(118, right + rightDepth) : right - rightDepth;
  const bottomX = 44 + ((hash >>> 20) & 15);
  const bottomWidth = 17 + ((hash >>> 24) & 7);
  const bottomDepth = 8 + Math.min(5, facts.scalarCount + ((hash >>> 27) & 3));
  const bottomFeatureY = (hash >>> 29) & 1 ? Math.min(86, bottom + bottomDepth) : bottom - bottomDepth;
  const leftY = 29 + ((hash >>> 5) & 13);
  const leftHeight = 17 + ((hash >>> 15) & 7);
  const leftDepth = 8 + Math.min(5, facts.requiredCount + ((hash >>> 25) & 3));
  const leftFeatureX = (hash >>> 31) & 1 ? Math.max(2, left - leftDepth) : left + leftDepth;
  const path = [
    `M ${left + corner} ${top}`,
    `H ${topX}`,
    `L ${topX + 5} ${topFeatureY}`,
    `H ${topX + topWidth - 5}`,
    `L ${topX + topWidth} ${top}`,
    `H ${right - corner}`,
    `L ${right} ${top + corner}`,
    `V ${rightY}`,
    `L ${rightFeatureX} ${rightY + 5}`,
    `V ${rightY + rightHeight - 5}`,
    `L ${right} ${rightY + rightHeight}`,
    `V ${bottom - corner}`,
    `L ${right - corner} ${bottom}`,
    `H ${bottomX + bottomWidth}`,
    `L ${bottomX + bottomWidth - 5} ${bottomFeatureY}`,
    `H ${bottomX + 5}`,
    `L ${bottomX} ${bottom}`,
    `H ${left + corner}`,
    `L ${left} ${bottom - corner}`,
    `V ${leftY + leftHeight}`,
    `L ${leftFeatureX} ${leftY + leftHeight - 5}`,
    `V ${leftY + 5}`,
    `L ${left} ${leftY}`,
    `V ${top + corner}`,
    "Z",
  ].join(" ");
  const requiredCount = Math.max(1, Math.min(7, facts.requiredCount));
  const marks = Array.from({ length: requiredCount }, (_, index) => ({
    x: 35 + (index % 4) * 17,
    y: 35 + Math.floor(index / 4) * 19,
    radius: 2.5 + ((hash >>> (index * 3)) & 1),
  }));
  const fingerprint = Object.freeze([family, topFeatureY < top ? -1 : 1, rightFeatureX < right ? -1 : 1, bottomFeatureY < bottom ? -1 : 1, leftFeatureX < left ? -1 : 1, topX, topWidth, topDepth, rightY, rightHeight, rightDepth, bottomX, bottomWidth, bottomDepth, leftY, leftHeight, leftDepth, requiredCount]);
  return Object.freeze({ signature, hash, path, marks: Object.freeze(marks), fingerprint });
}

export function profileShapeDistance(leftProfile, rightProfile) {
  const left = profileShapeModel(leftProfile).fingerprint;
  const right = profileShapeModel(rightProfile).fingerprint;
  return left.reduce((distance, value, index) => {
    if (index === 0) return distance + (value === right[index] ? 0 : 4);
    if (index < 5) return distance + (value === right[index] ? 0 : 3);
    return distance + Math.min(3, Math.abs(value - right[index]) / 4);
  }, 0);
}

const PROFILE_SOCKET_SEAT = Object.freeze({ x: 29, y: 15, scale: 0.68 });

export function profileSocketModel(profile) {
  const shape = profileShapeModel(profile);
  const seat = PROFILE_SOCKET_SEAT;
  return Object.freeze({
    signature: shape.signature,
    hash: shape.hash,
    path: shape.path,
    seat,
    transform: `translate(${seat.x} ${seat.y}) scale(${seat.scale})`,
  });
}
