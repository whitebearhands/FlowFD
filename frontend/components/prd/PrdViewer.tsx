import { Prd } from "@/types/prd";

type Props = {
  prd: Prd;
};

export default function PrdViewer({ prd }: Props) {
  const content = prd.content;
  return (
    <div className="text-sm text-zinc-800 space-y-2">
      {content.overview && <p className="text-zinc-700">{content.overview}</p>}
    </div>
  );
}
