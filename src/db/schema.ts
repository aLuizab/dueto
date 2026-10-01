/**
 * Migrations versionadas do SQLite. Cada entrada roda uma vez, em ordem, dentro de uma transação.
 * Nunca edite uma migration já publicada: adicione uma nova.
 */
export interface Migration {
  version: number;
  nome: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    nome: "esquema inicial",
    sql: `
      CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL, applied_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY, tipo TEXT NOT NULL, nome TEXT NOT NULL, documento TEXT, municipio TEXT, uf TEXT, regime TEXT,
        config TEXT NOT NULL DEFAULT '{}', ativa INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, nome TEXT NOT NULL, tipo TEXT NOT NULL, instituicao TEXT, moeda TEXT NOT NULL DEFAULT 'BRL',
        dia_fechamento INTEGER, dia_vencimento INTEGER, ativa INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY, nome TEXT NOT NULL, parent_id TEXT, tipo TEXT NOT NULL, fixa INTEGER NOT NULL DEFAULT 0,
        dedutivel_livro_caixa INTEGER NOT NULL DEFAULT 0, conta_dre TEXT, escopo TEXT, cor TEXT, icone TEXT
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, account_id TEXT, category_id TEXT, kind TEXT NOT NULL,
        competencia TEXT NOT NULL, vencimento TEXT, pagamento TEXT, valor REAL NOT NULL, moeda TEXT NOT NULL DEFAULT 'BRL', cotacao REAL,
        valor_brl REAL NOT NULL, descricao TEXT NOT NULL, status TEXT NOT NULL, parcela_atual INTEGER, parcela_total INTEGER,
        grupo_parcelamento_id TEXT, recorrencia_id TEXT, tags TEXT NOT NULL DEFAULT '[]', anexo TEXT, valor_expressao TEXT, pago_por TEXT,
        client_id TEXT, patient_id TEXT, exportacao INTEGER NOT NULL DEFAULT 0, invoice_id TEXT, origem_id TEXT, custo_cambio_brl REAL, meta TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_tx_entity_comp ON transactions(entity_id, competencia);
      CREATE INDEX IF NOT EXISTS idx_tx_comp ON transactions(competencia);
      CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);
      CREATE INDEX IF NOT EXISTS idx_tx_grupo ON transactions(grupo_parcelamento_id);
      CREATE TABLE IF NOT EXISTS recurrences (
        id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, descricao TEXT NOT NULL, category_id TEXT, account_id TEXT, kind TEXT NOT NULL,
        periodicidade TEXT NOT NULL, dia_vencimento INTEGER NOT NULL, mes_vencimento INTEGER, valor_padrao REAL NOT NULL, moeda TEXT NOT NULL DEFAULT 'BRL',
        ativa INTEGER NOT NULL DEFAULT 1, inicio TEXT NOT NULL, fim TEXT
      );
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, numero TEXT NOT NULL, data TEXT NOT NULL, client_id TEXT, tomador TEXT NOT NULL,
        moeda TEXT NOT NULL, valor REAL NOT NULL, cotacao REAL, valor_brl REAL NOT NULL, tipo TEXT NOT NULL, status TEXT NOT NULL,
        codigo_servico TEXT, municipio TEXT, transaction_ids TEXT NOT NULL DEFAULT '[]'
      );
      CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, nome TEXT NOT NULL, tipo TEXT NOT NULL, pais TEXT, moeda TEXT NOT NULL DEFAULT 'USD');
      CREATE TABLE IF NOT EXISTS patients (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, nome TEXT NOT NULL, valor_consulta REAL, ativo INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS investments (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, nome TEXT NOT NULL, instituicao TEXT, tipo TEXT NOT NULL, indexador TEXT, ativo INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS investment_snapshots (id TEXT PRIMARY KEY, investment_id TEXT NOT NULL, data TEXT NOT NULL, saldo REAL NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_snap_inv ON investment_snapshots(investment_id, data);
      CREATE TABLE IF NOT EXISTS contributions (id TEXT PRIMARY KEY, investment_id TEXT NOT NULL, transaction_id TEXT, data TEXT NOT NULL, valor REAL NOT NULL);
      CREATE TABLE IF NOT EXISTS tax_tables (id TEXT PRIMARY KEY, kind TEXT NOT NULL, vigencia_inicio TEXT NOT NULL, ativa INTEGER NOT NULL DEFAULT 1, origem TEXT NOT NULL DEFAULT 'seed', data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS payroll (
        id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, pessoa_id TEXT NOT NULL, competencia TEXT NOT NULL, bruto REAL NOT NULL, inss REAL NOT NULL,
        irrf REAL NOT NULL, liquido REAL NOT NULL, darf_valor REAL NOT NULL, darf_vencimento TEXT NOT NULL, darf_pago INTEGER NOT NULL DEFAULT 0, transaction_ids TEXT NOT NULL DEFAULT '[]'
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_comp ON payroll(entity_id, pessoa_id, competencia);
      CREATE TABLE IF NOT EXISTS goals (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, nome TEXT NOT NULL, valor_alvo REAL NOT NULL, prazo TEXT, valor_atual REAL NOT NULL DEFAULT 0, investment_id TEXT);
      CREATE TABLE IF NOT EXISTS budgets (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, category_id TEXT NOT NULL, competencia TEXT NOT NULL, valor_meta REAL NOT NULL);
      CREATE TABLE IF NOT EXISTS categ_rules (id TEXT PRIMARY KEY, pattern TEXT NOT NULL, regex INTEGER NOT NULL DEFAULT 0, category_id TEXT NOT NULL, escopo TEXT, aprendida INTEGER NOT NULL DEFAULT 0, prioridade INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS obligations_done (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, competencia TEXT NOT NULL, done_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `,
  },
  {
    version: 2,
    nome: "remove o perfil autônomo PF",
    sql: `
      CREATE TEMP TABLE _aut AS SELECT id FROM entities WHERE tipo = 'AUTONOMO_PF';
      CREATE TEMP TABLE _aut_tx AS SELECT id FROM transactions WHERE entity_id IN (SELECT id FROM _aut) OR category_id LIKE 'pf-%';
      UPDATE contributions SET transaction_id = NULL WHERE transaction_id IN (SELECT id FROM _aut_tx);
      UPDATE transactions SET origem_id = NULL WHERE origem_id IN (SELECT id FROM _aut_tx);
      DELETE FROM transactions WHERE id IN (SELECT id FROM _aut_tx);
      DELETE FROM recurrences WHERE entity_id IN (SELECT id FROM _aut) OR category_id LIKE 'pf-%';
      DELETE FROM accounts WHERE entity_id IN (SELECT id FROM _aut);
      DELETE FROM invoices WHERE entity_id IN (SELECT id FROM _aut);
      DELETE FROM clients WHERE entity_id IN (SELECT id FROM _aut);
      DELETE FROM goals WHERE entity_id IN (SELECT id FROM _aut);
      DELETE FROM budgets WHERE entity_id IN (SELECT id FROM _aut) OR category_id LIKE 'pf-%';
      DELETE FROM obligations_done WHERE entity_id IN (SELECT id FROM _aut);
      DELETE FROM entities WHERE id IN (SELECT id FROM _aut);
      UPDATE transactions SET category_id = NULL WHERE category_id = 'rec-autonomo';
      UPDATE recurrences SET category_id = NULL WHERE category_id = 'rec-autonomo';
      DELETE FROM budgets WHERE category_id = 'rec-autonomo';
      DELETE FROM categ_rules WHERE category_id LIKE 'pf-%' OR category_id = 'rec-autonomo';
      DELETE FROM categories WHERE id LIKE 'pf-%' OR id = 'rec-autonomo' OR escopo = '["AUTONOMO_PF"]';
      UPDATE categories SET escopo = REPLACE(REPLACE(escopo, ',"AUTONOMO_PF"', ''), '"AUTONOMO_PF",', '') WHERE escopo LIKE '%AUTONOMO_PF%';
      UPDATE categ_rules SET escopo = REPLACE(REPLACE(escopo, ',"AUTONOMO_PF"', ''), '"AUTONOMO_PF",', '') WHERE escopo LIKE '%AUTONOMO_PF%';
      DELETE FROM settings WHERE key LIKE 'autonomo.%';
      DROP TABLE IF EXISTS patients;
      DROP TABLE _aut_tx;
      DROP TABLE _aut;
    `,
  },
  {
    version: 3,
    nome: "aba Casa passa a se chamar Pessoal",
    sql: `UPDATE entities SET nome = 'Pessoal' WHERE tipo = 'CASAL' AND nome IN ('Orçamento da casa', 'Casa');`,
  },
];
