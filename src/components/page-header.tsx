import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  className?: string;
};

export function PageHeader({ title, description, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6", className)}>
      <h1 className="text-3xl font-bold font-headline tracking-tight">{title}</h1>
      {description && (
        <p className="mt-1 text-lg text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
