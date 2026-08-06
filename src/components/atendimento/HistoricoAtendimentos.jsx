import React, { useState, useEffect } from 'react';
import { atendimentoService } from '../../lib/atendimentoService';

const HistoricoAtendimentos = ({ onShowToast }) => {
  const [historico, setHistorico] = useState([]);
  const [capacidades, setCapacidades] = useState([]);
  const [programacoes, setProgramacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await atendimentoService.getHistoricoGeral();
      setHistorico(list);

      const caps = await atendimentoService.getCapacidades();
      setCapacidades(caps);

      const progs = await atendimentoService.getAllProgramacoes();
      setProgramacoes(progs);
    } catch (err) {
      console.error(err);
      onShowToast('Erro ao carregar histórico: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Mapeia programações por pessoa_id para referência rápida
  const programacoesMap = {};
  programacoes.forEach(p => {
    if (p.pessoa_id && p.status !== 'cancelado') {
      programacoesMap[p.pessoa_id] = p;
    }
  });

  const filtered = historico.filter(item => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const pName = item.atendimento_pessoas?.nome?.toLowerCase() || '';
    const aName = item.profiles?.name?.toLowerCase() || '';
    const action = item.action?.toLowerCase() || '';
    return pName.includes(term) || aName.includes(term) || action.includes(term);
  });

  const formatAcaoRealizada = (item) => {
    const adminName = item.profiles?.name || 'Administrador';
    const action = item.action;

    switch (action) {
      case 'CADASTRO_PESSOA':
        return `Cadastro da Pessoa por ${adminName}`;
      case 'CADASTRO_E_PROGRAMACAO_URGENTE':
        return `Cadastro e Programação por ${adminName}`;
      case 'EDICAO_PESSOA':
        return `Atualizado por ${adminName}`;
      case 'REORGANIZACAO_FILA':
        return `Reorganizado por ${adminName}`;
      case 'PROGRAMACAO_ATENDIMENTO':
        return `Programado por ${adminName}`;
      case 'REMANEJAMENTO_URGENCIA':
      case 'REMANEJAMENTO_URGENCIA_REAGENDADO':
        return `Remanejado por ${adminName}`;
      case 'STATUS_COMPARECEU':
        return `Comparecimento registrado por ${adminName}`;
      case 'STATUS_ATENDIDO':
        return `Atendimento realizado por ${adminName}`;
      case 'STATUS_NAO_COMPARECEU':
        return `Falta registrada por ${adminName}`;
      case 'STATUS_CANCELADO':
        return `Cancelado por ${adminName}`;
      case 'STATUS_RETORNAR_FILA':
        return `Retornado à fila por ${adminName}`;
      default:
        return `${action} por ${adminName}`;
    }
  };

  const renderPrevisaoColuna = (item) => {
    const pessoa = item.atendimento_pessoas;
    if (!pessoa) return <span className="text-gray-400 text-xs italic">-</span>;

    const status = pessoa.status;

    if (status === 'atendido' || status === 'compareceu') {
      return (
        <span className="px-2.5 py-1 bg-green-100 text-green-800 text-[11px] font-bold rounded-md">
          Realizado
        </span>
      );
    }

    if (status === 'cancelado') {
      return (
        <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-[11px] font-bold rounded-md">
          Cancelado
        </span>
      );
    }

    if (status === 'programado') {
      const prog = item.atendimento_programacoes || programacoesMap[pessoa.id];
      if (prog && prog.event_date) {
        const parts = prog.event_date.split('-');
        const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        const timeStr = prog.start_time ? prog.start_time.slice(0, 5) : '';

        return (
          <div className="flex flex-col text-xs">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 block">
              Programado para
            </span>
            <span className="font-bold text-primary">
              {formattedDate} {timeStr ? `- ${timeStr}` : ''}
            </span>
          </div>
        );
      }
      return <span className="text-xs font-bold text-indigo-600">Programado</span>;
    }

    if (status === 'aguardando' && pessoa.posicao_fila) {
      const prev = atendimentoService.calculatePrevisaoReal(pessoa.posicao_fila, capacidades, programacoes, pessoa);
      if (prev && prev.formattedDate) {
        return (
          <div className="flex flex-col text-xs">
            <span className="font-bold text-primary">{prev.formattedDate}</span>
            <span className="text-[10px] text-gray-500 font-medium">{prev.dayOfWeek} - {prev.time}</span>
          </div>
        );
      }
    }

    return <span className="text-gray-400 text-xs italic">Sem previsão</span>;
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header & Busca */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="font-headline font-bold text-xl text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600">history</span>
            Histórico Completo de Auditoria
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Registro imutável de cadastros, movimentações, reagendamentos e ações administrativas.
          </p>
        </div>

        <div className="w-full md:w-72 relative">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-base">search</span>
          <input
            type="text"
            placeholder="Filtrar histórico..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Lista de Histórico */}
      {loading ? (
        <div className="py-20 text-center text-gray-400 italic">Carregando histórico de auditoria...</div>
      ) : filtered.length > 0 ? (
        <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-gray-50/50 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-6 py-4">Data / Hora</th>
                <th className="px-6 py-4">Pessoa</th>
                <th className="px-6 py-4">Ação Realizada</th>
                <th className="px-6 py-4">Previsão do Atendimento</th>
                <th className="px-6 py-4">Observação / Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/30">
                  <td className="px-6 py-4 text-xs font-mono font-medium text-gray-500 whitespace-nowrap">
                    {new Date(item.created_at).toLocaleString('pt-BR')}
                  </td>

                  <td className="px-6 py-4 font-bold text-primary text-sm whitespace-nowrap">
                    {item.atendimento_pessoas?.nome || 'Não identificado'}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1.5 bg-amber-50 text-amber-800 text-xs font-extrabold rounded-xl border border-amber-200/70 inline-block">
                      {formatAcaoRealizada(item)}
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    {renderPrevisaoColuna(item)}
                  </td>

                  <td className="px-6 py-4 text-xs text-gray-600 font-medium">
                    {item.observacao || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-3xl p-12 text-center text-gray-400 italic border border-dashed border-gray-200">
          Nenhum registro de histórico encontrado.
        </div>
      )}
    </div>
  );
};

export default HistoricoAtendimentos;
