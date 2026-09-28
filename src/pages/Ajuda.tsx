import { ComoUsar } from "@/components/ComoUsar";
import { Card, PageHeader } from "@/components/ui";

export default function Ajuda() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Como usar" subtitle="O caminho do primeiro dia ao fechamento do mês." />
      <Card><ComoUsar /></Card>
    </div>
  );
}
