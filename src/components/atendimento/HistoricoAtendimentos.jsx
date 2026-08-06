import React, { useState, useEffect } from 'react';
import { atendimentoService } from '../../lib/atendimentoService';

const HistoricoAtendimentos = ({ onShowToast }) => {
  const [historico, setHistorico] = useState([]);
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
    } catch (err) {
      console.error(err);
      onShowToast('Erro ao carregar histórico: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const filtered = historico.filter(item => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const pName = item.atendimento_pessoas?.nome?.toLowerCase() || '';
    const aName = item.profiles?.name?.toLowerCase() || '';
    const action = item.action?.toLowerCase() || '';
    return pName.includes(term) || aName.includes(term) || action.includes(term);
  });

  const ACTION_LABELS = {
    CADASTRO_PESSOA: 'Cadastro de Paciente',
    EDICAO_PESSOA: 'Edição de Dados',
    REORGANIZACAO_FILA: 'Reorganização da Fila',
    PROGRAMACAO_ATENDIMENTO: 'Programação de Atendimento',
    REMANEJAMENTO_URGENCIA: 'Remanejamento de Urgência',
    STATUS_COMPARECEU: 'Comparecimento Registrado',
    STATUS_ATENDIDO: 'Atendimento Realizado',
    STATUS_NAO_COMPARECEU: 'Falta Registrada',
    STATUS_CANCELADO: 'Agendamento Cancelado',
    STATUS_RETORNAR_FILA: 'Retorno à Fila',
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header & Busca */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="font-headline font-bold text-xl text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">history</span>
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
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="bg-gray-50/50 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-6 py-4">Data / Hora</th>
                <th className="px-6 py-4">Paciente</th>
                <th className="px-6 py-4">Ação Realizada</th>
                <th className="px-6 py-4">Administrador</th>
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

                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-primary/5 text-primary text-[10px] font-extrabold rounded-md uppercase">
                      {ACTION_LABELS[item.action] || item.action}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-xs font-bold text-gray-700 whitespace-nowrap">
                    {item.profiles?.name || 'Administrador'}
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
