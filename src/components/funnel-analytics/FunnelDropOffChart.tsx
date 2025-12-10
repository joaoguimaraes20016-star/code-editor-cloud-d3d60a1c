import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { Card } from '@/components/ui/card';
import { TrendingDown, Users, CheckCircle, AlertTriangle, ArrowRight, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FunnelStep {
  id: string;
  order_index: number;
  step_type: string;
  content: { headline?: string };
}

interface FunnelLead {
  id: string;
  last_step_index: number | null;
  status: string;
}

interface FunnelDropOffChartProps {
  steps: FunnelStep[];
  leads: FunnelLead[];
  funnelName: string;
}

export function FunnelDropOffChart({ steps, leads, funnelName }: FunnelDropOffChartProps) {
  const data = useMemo(() => {
    if (!steps.length || !leads.length) return [];

    const sortedSteps = [...steps].sort((a, b) => a.order_index - b.order_index);
    
    // Count how many leads reached each step (at least)
    const stepCounts = sortedSteps.map((step, index) => {
      const count = leads.filter(lead => 
        (lead.last_step_index ?? 0) >= index
      ).length;
      
      return {
        name: getStepLabel(step, index),
        stepType: step.step_type,
        count,
        index,
      };
    });

    // Calculate drop-off rates
    return stepCounts.map((step, i) => {
      const prevCount = i === 0 ? leads.length : stepCounts[i - 1].count;
      const dropOff = prevCount > 0 ? Math.round(((prevCount - step.count) / prevCount) * 100) : 0;
      const retention = leads.length > 0 ? Math.round((step.count / leads.length) * 100) : 0;
      
      return {
        ...step,
        dropOff,
        retention,
        fill: getStepColor(step.stepType),
      };
    });
  }, [steps, leads]);

  const totalStarted = leads.length;
  const totalCompleted = data.length > 0 ? data[data.length - 1]?.count || 0 : 0;
  const overallConversion = totalStarted > 0 ? Math.round((totalCompleted / totalStarted) * 100) : 0;

  // Find the biggest drop-off
  const biggestDropOff = data.reduce((max, step) => 
    step.dropOff > max.dropOff ? step : max
  , { name: '', dropOff: 0, stepType: '' });

  if (!data.length) {
    return (
      <Card className="p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <Target className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">Select a funnel to view analytics</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Visual Funnel Header */}
      <Card className="p-6 bg-gradient-to-br from-primary/5 via-background to-purple-500/5 border-primary/20">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">{funnelName || 'Funnel'} Analytics</h3>
            <p className="text-sm text-muted-foreground">{totalStarted} total visitors</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary">{overallConversion}%</div>
            <p className="text-sm text-muted-foreground">conversion rate</p>
          </div>
        </div>
        
        {/* Visual Funnel Shape */}
        <div className="relative py-4">
          <div className="flex items-center justify-center gap-1">
            {data.map((step, i) => {
              const widthPercent = 100 - (i * (70 / data.length));
              return (
                <div key={i} className="flex flex-col items-center flex-1">
                  <div 
                    className="relative h-16 rounded-lg transition-all duration-300 hover:scale-105"
                    style={{ 
                      width: `${widthPercent}%`,
                      background: `linear-gradient(135deg, ${step.fill}40, ${step.fill}20)`,
                      border: `1px solid ${step.fill}50`
                    }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold" style={{ color: step.fill }}>
                        {step.count}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-2 text-center truncate w-full px-1">
                    {step.name}
                  </span>
                  {i < data.length - 1 && step.dropOff > 0 && (
                    <div className="absolute -bottom-1 right-0 transform translate-x-1/2">
                      <span className="text-[9px] text-red-500 font-medium">-{step.dropOff}%</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/20">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Started</p>
              <p className="text-2xl font-bold">{totalStarted}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/20">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Completed</p>
              <p className="text-2xl font-bold">{totalCompleted}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/20">
              <Target className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Conversion</p>
              <p className="text-2xl font-bold">{overallConversion}%</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-red-500/20">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Biggest Drop</p>
              <p className="text-lg font-bold truncate">{biggestDropOff.dropOff}%</p>
              <p className="text-[10px] text-muted-foreground truncate">{biggestDropOff.name}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Retention Area Chart */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
          User Retention Through Funnel
        </h3>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: 0, right: 20, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="retentionGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-popover border rounded-lg p-3 shadow-lg">
                      <p className="font-medium text-sm">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.count} users ({d.retention}% retained)</p>
                      {d.dropOff > 0 && (
                        <p className="text-xs text-red-500">↓ {d.dropOff}% drop-off</p>
                      )}
                    </div>
                  );
                }}
              />
              <Area 
                type="monotone" 
                dataKey="retention" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                fill="url(#retentionGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Step-by-step breakdown */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Step-by-Step Breakdown</h3>
        <div className="space-y-4">
          {data.map((step, i) => (
            <div key={i} className="group">
              <div className="flex items-center gap-4">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 transition-transform group-hover:scale-110" 
                  style={{ backgroundColor: step.fill + '20', color: step.fill }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-sm truncate">{step.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{step.count}</span>
                      <span className="text-xs text-muted-foreground">({step.retention}%)</span>
                    </div>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500 relative overflow-hidden"
                      style={{ 
                        width: `${step.retention}%`,
                        backgroundColor: step.fill 
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                    </div>
                  </div>
                </div>
                {step.dropOff > 0 && (
                  <div className={cn(
                    "px-2 py-1 rounded-md text-xs font-medium shrink-0",
                    step.dropOff > 30 ? "bg-red-500/10 text-red-500" : 
                    step.dropOff > 15 ? "bg-amber-500/10 text-amber-500" : 
                    "bg-muted text-muted-foreground"
                  )}>
                    -{step.dropOff}%
                  </div>
                )}
              </div>
              {i < data.length - 1 && (
                <div className="ml-5 pl-4 border-l-2 border-dashed border-muted h-4" />
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function getStepLabel(step: FunnelStep, index: number): string {
  const headline = step.content?.headline;
  if (headline) {
    // Strip HTML and truncate
    const text = headline.replace(/<[^>]*>/g, '').trim();
    return text.length > 20 ? text.slice(0, 20) + '...' : text;
  }
  
  const typeLabels: Record<string, string> = {
    welcome: 'Welcome',
    text_question: 'Question',
    multi_choice: 'Multi-Choice',
    email_capture: 'Email',
    phone_capture: 'Phone',
    opt_in: 'Opt-In',
    video: 'Video',
    embed: 'Embed',
    thank_you: 'Thank You',
  };
  
  return typeLabels[step.step_type] || `Step ${index + 1}`;
}

function getStepColor(stepType: string): string {
  const colors: Record<string, string> = {
    welcome: '#3b82f6',
    text_question: '#8b5cf6',
    multi_choice: '#a855f7',
    email_capture: '#06b6d4',
    phone_capture: '#14b8a6',
    opt_in: '#22c55e',
    video: '#f59e0b',
    embed: '#f97316',
    thank_you: '#10b981',
  };
  return colors[stepType] || '#6b7280';
}