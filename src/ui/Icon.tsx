import { iconUrl } from "../game/icons";

/** A pixel icon of any item, resource or ammo type. */
export function Icon({ id, size = 40 }: { id: string; size?: number }) {
  return <img className="icon" src={iconUrl(id)} width={size} height={size} draggable={false} alt="" />;
}
