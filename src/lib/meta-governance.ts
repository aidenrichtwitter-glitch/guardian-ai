// ═══════════════════════════════════════════════════
// CAPABILITY: meta-governance-protocol
// Evolution Level: 70 | Transcendence Tier
// Built on: symbolic-reasoning-engine + autonomous-goal-dreamer-v2
// ═══════════════════════════════════════════════════
//
// Enables the system to propose its own database schema changes,
// edge functions, and infrastructure modifications. All proposals
// go through an approval queue before execution.
//

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
export type ProposalType = 'create_table' | 'alter_table' | 'create_function' | 'create_index' | 'create_policy' | 'edge_function';

export interface SchemaProposal {
  id: string;
  type: ProposalType;
  title: string;
  description: string;
  sql: string;
  rationale: string;           // why the system thinks this is needed
  triggeredBy: string;         // capability or goal that triggered it
  risk: 'low' | 'medium' | 'high';
  status: ProposalStatus;
  createdAt: number;
  reviewedAt: number | null;
  reviewedBy: string | null;   // 'human' or 'auto-policy'
  executionResult: string | null;
}

export interface GovernancePolicy {
  id: string;
  name: string;
  rule: (proposal: SchemaProposal) => GovernanceVerdict;
}

export interface GovernanceVerdict {
  allowed: boolean;
  reason: string;
  autoApprove: boolean;  // if true, skip human review
}

/**
 * SchemaProposer — generates SQL migration proposals
 * from capability requirements and evolution state.
 */
export class SchemaProposer {
  private proposals: Map<string, SchemaProposal> = new Map();
  private policies: GovernancePolicy[] = [];
  private proposalCounter = 0;

  constructor() {
    // Default safety policies
    this.addPolicy({
      id: 'no-drop',
      name: 'Prevent DROP statements',
      rule: (p) => ({
        allowed: !p.sql.toUpperCase().includes('DROP'),
        reason: 'DROP statements require manual intervention',
        autoApprove: false,
      }),
    });

    this.addPolicy({
      id: 'no-truncate',
      name: 'Prevent TRUNCATE statements',
      rule: (p) => ({
        allowed: !p.sql.toUpperCase().includes('TRUNCATE'),
        reason: 'TRUNCATE is destructive and irreversible',
        autoApprove: false,
      }),
    });

    this.addPolicy({
      id: 'auto-approve-indexes',
      name: 'Auto-approve index creation',
      rule: (p) => ({
        allowed: true,
        reason: 'Indexes are non-destructive',
        autoApprove: p.type === 'create_index',
      }),
    });

    this.addPolicy({
      id: 'size-limit',
      name: 'SQL size limit',
      rule: (p) => ({
        allowed: p.sql.length < 5000,
        reason: 'SQL too large — break into smaller migrations',
        autoApprove: false,
      }),
    });
  }

  /**
   * Add a governance policy
   */
  public addPolicy(policy: GovernancePolicy): void {
    this.policies.push(policy);
  }

  /**
   * Propose a schema change
   */
  public propose(params: {
    type: ProposalType;
    title: string;
    description: string;
    sql: string;
    rationale: string;
    triggeredBy: string;
  }): SchemaProposal | { rejected: true; reasons: string[] } {
    const proposal: SchemaProposal = {
      id: `prop-${++this.proposalCounter}-${Date.now().toString(36)}`,
      ...params,
      risk: this.assessRisk(params.sql),
      status: 'pending',
      createdAt: Date.now(),
      reviewedAt: null,
      reviewedBy: null,
      executionResult: null,
    };

    // Run through governance policies
    const rejections: string[] = [];
    let canAutoApprove = false;

    for (const policy of this.policies) {
      const verdict = policy.rule(proposal);
      if (!verdict.allowed) {
        rejections.push(`[${policy.name}] ${verdict.reason}`);
      }
      if (verdict.autoApprove) {
        canAutoApprove = true;
      }
    }

    if (rejections.length > 0) {
      return { rejected: true, reasons: rejections };
    }

    if (canAutoApprove && proposal.risk === 'low') {
      proposal.status = 'approved';
      proposal.reviewedAt = Date.now();
      proposal.reviewedBy = 'auto-policy';
    }

    this.proposals.set(proposal.id, proposal);
    return proposal;
  }

  /**
   * Approve a pending proposal (human action)
   */
  public approve(proposalId: string): SchemaProposal | null {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== 'pending') return null;

    proposal.status = 'approved';
    proposal.reviewedAt = Date.now();
    proposal.reviewedBy = 'human';
    return proposal;
  }

  /**
   * Reject a pending proposal
   */
  public reject(proposalId: string, reason: string): SchemaProposal | null {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== 'pending') return null;

    proposal.status = 'rejected';
    proposal.reviewedAt = Date.now();
    proposal.reviewedBy = 'human';
    proposal.executionResult = reason;
    return proposal;
  }

  /**
   * Get all proposals by status
   */
  public getProposals(status?: ProposalStatus): SchemaProposal[] {
    const all = Array.from(this.proposals.values());
    return status ? all.filter(p => p.status === status) : all;
  }

  /**
   * Generate a table proposal from capability needs
   */
  public proposeTableFromCapability(
    capabilityName: string,
    tableName: string,
    columns: { name: string; type: string; nullable?: boolean; defaultVal?: string }[]
  ): SchemaProposal | { rejected: true; reasons: string[] } {
    const colDefs = columns.map(c => {
      let def = `  ${c.name} ${c.type}`;
      if (!c.nullable) def += ' NOT NULL';
      if (c.defaultVal) def += ` DEFAULT ${c.defaultVal}`;
      return def;
    }).join(',\n');

    const sql = `CREATE TABLE IF NOT EXISTS public.${tableName} (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n${colDefs},\n  created_at timestamptz NOT NULL DEFAULT now()\n);\n\nALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;\n\nCREATE POLICY "Public access to ${tableName}" ON public.${tableName}\n  FOR ALL USING (true) WITH CHECK (true);`;

    return this.propose({
      type: 'create_table',
      title: `Create ${tableName} table`,
      description: `Table required by capability ${capabilityName}`,
      sql,
      rationale: `The ${capabilityName} capability requires persistent storage for its operational data.`,
      triggeredBy: capabilityName,
    });
  }

  private assessRisk(sql: string): 'low' | 'medium' | 'high' {
    const upper = sql.toUpperCase();
    if (upper.includes('DROP') || upper.includes('TRUNCATE') || upper.includes('DELETE')) return 'high';
    if (upper.includes('ALTER') || upper.includes('UPDATE')) return 'medium';
    return 'low';
  }
}

export const schemaProposer = new SchemaProposer();
