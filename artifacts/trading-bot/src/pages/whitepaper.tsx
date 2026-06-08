import { useState } from "react";
import { useGetWhitepaper, getGetWhitepaperQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

export default function Whitepaper() {
  const { data: wp, isLoading } = useGetWhitepaper({ query: { queryKey: getGetWhitepaperQueryKey() } });
  const [activeSection, setActiveSection] = useState<string | null>(null);

  if (isLoading) return <div className="p-8 text-muted-foreground text-center">Loading whitepaper...</div>;
  if (!wp) return <div className="p-8 text-muted-foreground text-center">Whitepaper not found</div>;

  const currentSection = activeSection || wp.sections[0]?.id;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col space-y-6">
      <div className="flex justify-between items-baseline shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary font-serif">{wp.title}</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">v{wp.version} • Last updated: {new Date(wp.lastUpdated).toLocaleDateString()}</p>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden flex bg-card border-border/50">
        {/* Sidebar Nav */}
        <div className="w-64 border-r border-border/50 bg-muted/20 shrink-0 flex flex-col">
          <div className="p-4 font-bold text-sm uppercase tracking-wider text-muted-foreground">Contents</div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              <button
                onClick={() => setActiveSection("abstract")}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                  currentSection === "abstract" ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"
                )}
              >
                Abstract
              </button>
              {wp.sections.map(section => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                    currentSection === section.id ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"
                  )}
                >
                  {section.title}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Content Area */}
        <ScrollArea className="flex-1 bg-background/50">
          <div className="max-w-3xl mx-auto p-8 lg:p-12 prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-headings:font-serif">
            {currentSection === "abstract" ? (
              <div>
                <h2 className="text-2xl font-bold font-serif mb-6 text-foreground">Abstract</h2>
                <div className="text-lg leading-relaxed text-muted-foreground font-serif italic">
                  {wp.abstract}
                </div>
              </div>
            ) : (
              wp.sections.filter(s => s.id === currentSection).map(section => (
                <div key={section.id}>
                  <h2 className="text-3xl font-bold font-serif mb-8 text-foreground">{section.title}</h2>
                  <div className="text-base leading-relaxed text-foreground/90 whitespace-pre-wrap mb-10">
                    {section.content}
                  </div>
                  
                  {section.subsections.length > 0 && (
                    <div className="space-y-12">
                      <Separator className="my-8" />
                      {section.subsections.map(sub => (
                        <div key={sub.id}>
                          <h3 className="text-xl font-bold font-serif mb-4 text-foreground">{sub.title}</h3>
                          <div className="text-base leading-relaxed text-foreground/90 whitespace-pre-wrap">
                            {sub.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
