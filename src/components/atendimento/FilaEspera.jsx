import React, { useState, useEffect } from 'react';
import { atendimentoService } from '../../lib/atendimentoService';
import { useAuth } from '../../context/AuthContext';
import ModalCadastroPessoa from './ModalCadastroPessoa';
import ModalProgramarSessao from './ModalProgramarSessao';
import ModalMoverPosicao from './ModalMoverPosicao';
import ModalReorganizacaoUrgente from './ModalReorganizacaoUrgente';

const FilaEspera = ({ onShowToast }) => {
  const { profile } = useAuth();
  const [pessoas, setPessoas] = useState([]);
  const [capacidades, setCapacidades] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros & Busca
  const [search, setSearch] = useState('');
  const [prioridadeFilter, setPrioridadeFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');

  // Modais
  const [isCadastroModalOpen, setIsCadastroModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);

  const [isProgramarModalOpen, setIsProgramarModalOpen] = useState(false);
  const [programarPerson, setProgramarPerson] = useState(null);

  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [movePerson, setMovePerson] = useState(null);

  const [urgentBumpData, setUrgentBumpData] = useState(null);

  useEffect(() => {
    loadData();
  }, [search, prioridadeFilter, tipoFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await atendimentoService.getPessoas({
        search,
        status: 'aguardando',
        prioridade: prioridadeFilter,
        tipo: tipoFilter,
      });
      setPessoas(data);

      const caps = await atendimentoService.getCapacidades();
      setCapacidades(caps);
    } catch (err) {
      console.error(err);
      onShowToast('Erro ao carregar fila de espera: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Total de vagas semanais configuradas
  const totalWeeklyCapacity = capacidades.reduce((acc, c) => acc + (c.capacidade || 6), 0);

  const handleOpenCadastro = (person = null) => {
    setEditingPerson(person);
    setIsCadastroModalOpen(true);
  };

  const handleSavedPessoa = (msg) => {
    onShowToast(msg, 'success');
    loadData();
  };

  const handleMovePos = async (personId, newPos) => {
    try {
      await atendimentoService.reorganizePosition(personId, newPos, profile.id);
      onShowToast('Posição alterada com sucesso!', 'success');
      loadData();
    } catch (err) {
      onShowToast('Erro ao mover posição: ' + err.message, 'error');
    }
  };

  const handleToggleUrgencia = async (person) => {
    const isUrgente = person.prioridade === 'Urgente';
    const newPrioridade = isUrgente ? 'Normal' : 'Urgente';
    try {
      await atendimentoService.updatePessoa(
        person.id,
        {
          prioridade: newPrioridade,
          motivo_urgencia: isUrgente ? null : (person.motivo_urgencia || 'Urgência definida pela administração'),
        },
        profile.id
      );

      if (newPrioridade === 'Urgente') {
        // Mover para a posição 1
        await atendimentoService.reorganizePosition(person.id, 1, profile.id);
        onShowToast('Pessoa marcada como Urgente e movida para a 1ª posição!', 'success');
      } else {
        onShowToast('Prioridade alterada para Normal.', 'success');
      }
      loadData();
    } catch (err) {
      onShowToast('Erro ao alterar urgência: ' + err.message, 'error');
    }
  };

  const handleDelete = async (person) => {
    if (window.confirm(`Deseja remover "${person.nome}" da fila de espera?`)) {
      try {
        await atendimentoService.deletePessoa(person.id, profile.id);
        onShowToast('Pessoa removida da fila.', 'success');
        loadData();
      } catch (err) {
        onShowToast(err.message, 'error');
      }
    }
  };

  const handleConfirmUrgentBump = async () => {
    if (!urgentBumpData) return;
    try {
      await atendimentoService.remanejarEInserirUrgencia({
        pessoaUrgenteId: urgentBumpData.person.id,
        atividadeId: urgentBumpData.atividade.id,
        eventDate: urgentBumpData.eventDate,
        startTime: urgentBumpData.atividade.start_time,
        endTime: urgentBumpData.atividade.end_time,
        pessoaParaRemanejarId: urgentBumpData.lastNormalPerson?.pessoa_id,
        adminId: profile.id,
      });

      onShowToast('Atendimento urgente inserido e remanejamento realizado com sucesso!', 'success');
      setUrgentBumpData(null);
      loadData();
    } catch (err) {
      onShowToast('Erro ao remanejar: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Banner & Previsão Info */}
      <div className="bg-gradient-to-r from-primary to-primary/95 text-white p-6 rounded-3xl shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">Fila de Espera Ativa</span>
            <h3 className="text-2xl font-headline font-bold">Fila Geral de Atendimento</h3>
          </div>
          <button
            onClick={() => handleOpenCadastro()}
            className="bg-white text-primary px-5 py-3 rounded-2xl font-bold text-xs shadow-md hover:bg-gray-50 transition-all flex items-center gap-2 active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined text-lg">person_add</span>
            Cadastrar Pessoa na Fila
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm">
            <span className="text-[10px] text-white/70 uppercase font-bold tracking-wider block">Aguardando na Fila</span>
            <span className="text-xl font-bold font-headline">{pessoas.length} pessoas</span>
          </div>

          <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm">
            <span className="text-[10px] text-white/70 uppercase font-bold tracking-wider block">Capacidade Semanal</span>
            <span className="text-xl font-bold font-headline">{totalWeeklyCapacity} vagas/semana</span>
          </div>

          <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm">
            <span className="text-[10px] text-white/70 uppercase font-bold tracking-wider block">Regra de Cálculo</span>
            <span className="text-xs font-medium text-white/90">
              {totalWeeklyCapacity > 0 ? 'Previsão aproximada e dinâmica' : 'Aguardando capacidade'}
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-80 relative">
          <span className="material-symbols-outlined absolute left-3 top-3 text-gray-400 text-lg">search</span>
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-primary focus:ring-2 focus:ring-primary/20 outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={prioridadeFilter}
            onChange={e => setPrioridadeFilter(e.target.value)}
            className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-primary outline-none"
          >
            <option value="">Todas Prioridades</option>
            <option value="Normal">Normal</option>
            <option value="Urgente">Urgente</option>
          </select>

          <select
            value={tipoFilter}
            onChange={e => setTipoFilter(e.target.value)}
            className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-primary outline-none"
          >
            <option value="">Todos Tipos</option>
            <option value="Apometria">Apometria</option>
          </select>
        </div>
      </div>

      {/* Lista / Tabela da Fila de Espera */}
      {loading ? (
        <div className="py-20 text-center text-gray-400 italic">Carregando fila de espera...</div>
      ) : pessoas.length > 0 ? (
        <div className="space-y-4">
          {/* Tabela para Desktop */}
          <div className="hidden lg:block bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">
                  <th className="px-5 py-4">Posição</th>
                  <th className="px-5 py-4">Nome / Telefone</th>
                  <th className="px-5 py-4">Entrada</th>
                  <th className="px-5 py-4">Tipo / Prioridade</th>
                  <th className="px-5 py-4">Previsão Aproximada</th>
                  <th className="px-5 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pessoas.map((item, index) => {
                  const previsaoText = atendimentoService.calculatePrevisao(item.posicao_fila, totalWeeklyCapacity);
                  const isUrgente = item.prioridade === 'Urgente';

                  return (
                    <tr key={item.id} className={`hover:bg-gray-50/50 transition-colors ${isUrgente ? 'bg-amber-50/30' : ''}`}>
                      <td className="px-5 py-4 font-mono font-extrabold text-primary text-base">
                        #{item.posicao_fila}
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-bold text-primary text-sm">{item.nome}</div>
                        {item.telefone && (
                          <div className="text-xs text-gray-400 font-mono flex items-center gap-1 mt-0.5">
                            <span className="material-symbols-outlined text-[12px]">phone</span>
                            {item.telefone}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 text-xs font-medium text-gray-600">
                        {item.data_entrada ? item.data_entrada.split('-').reverse().join('/') : '-'}
                      </td>

                      <td className="px-5 py-4">
                        <div className="text-xs font-bold text-gray-700">{item.tipo_atendimento}</div>
                        {isUrgente ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold rounded-md mt-1 uppercase">
                            <span className="material-symbols-outlined text-[10px]">priority_high</span> Urgente
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-md mt-1 uppercase">
                            Normal
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-xs font-medium text-secondary max-w-xs">
                        {previsaoText}
                      </td>

                      <td className="px-5 py-4 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setProgramarPerson(item);
                            setIsProgramarModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-xl shadow-sm hover:brightness-110 active:scale-95 transition-all"
                        >
                          Programar
                        </button>

                        <button
                          onClick={() => handleOpenCadastro(item)}
                          className="p-1.5 text-gray-500 hover:text-primary transition-colors"
                          title="Editar"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>

                        <button
                          onClick={() => {
                            setMovePerson(item);
                            setIsMoveModalOpen(true);
                          }}
                          className="p-1.5 text-gray-500 hover:text-primary transition-colors"
                          title="Mover posição"
                        >
                          <span className="material-symbols-outlined text-lg">swap_vert</span>
                        </button>

                        <button
                          onClick={() => handleToggleUrgencia(item)}
                          className={`p-1.5 transition-colors ${isUrgente ? 'text-amber-600 hover:text-amber-800' : 'text-gray-400 hover:text-amber-600'}`}
                          title={isUrgente ? 'Remover urgência' : 'Marcar como urgente'}
                        >
                          <span className="material-symbols-outlined text-lg">priority_high</span>
                        </button>

                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                          title="Excluir"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cards para Celular */}
          <div className="grid grid-cols-1 gap-4 lg:hidden">
            {pessoas.map((item) => {
              const previsaoText = atendimentoService.calculatePrevisao(item.posicao_fila, totalWeeklyCapacity);
              const isUrgente = item.prioridade === 'Urgente';

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-3xl p-5 border shadow-sm space-y-4 ${
                    isUrgente ? 'border-amber-200 bg-amber-50/20' : 'border-gray-100'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 bg-primary/5 text-primary font-mono font-extrabold rounded-2xl flex items-center justify-center text-lg shrink-0">
                        #{item.posicao_fila}
                      </span>
                      <div>
                        <h4 className="font-bold text-primary text-base leading-tight">{item.nome}</h4>
                        {item.telefone && (
                          <span className="text-xs text-gray-400 font-mono block mt-0.5">{item.telefone}</span>
                        )}
                      </div>
                    </div>
                    {isUrgente ? (
                      <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-black rounded-full uppercase">
                        Urgente
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-[10px] font-black rounded-full uppercase">
                        Normal
                      </span>
                    )}
                  </div>

                  <div className="bg-gray-50/80 p-3 rounded-2xl text-xs space-y-1 text-gray-600">
                    <div>Entrada: <strong>{item.data_entrada ? item.data_entrada.split('-').reverse().join('/') : '-'}</strong></div>
                    <div>Tipo: <strong>{item.tipo_atendimento}</strong></div>
                    {item.motivo_urgencia && (
                      <div className="text-amber-800 italic pt-1 border-t border-gray-200/50">
                        Motivo Urgência: {item.motivo_urgencia}
                      </div>
                    )}
                    <div className="text-secondary font-bold pt-1 border-t border-gray-200/50">
                      {previsaoText}
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setProgramarPerson(item);
                        setIsProgramarModalOpen(true);
                      }}
                      className="flex-1 py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow-sm text-center"
                    >
                      Programar Atendimento
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenCadastro(item)}
                        className="p-2 text-gray-500 bg-gray-50 rounded-xl hover:bg-gray-100"
                        title="Editar"
                      >
                        <span className="material-symbols-outlined text-lg">edit</span>
                      </button>
                      <button
                        onClick={() => {
                          setMovePerson(item);
                          setIsMoveModalOpen(true);
                        }}
                        className="p-2 text-gray-500 bg-gray-50 rounded-xl hover:bg-gray-100"
                        title="Mover posição"
                      >
                        <span className="material-symbols-outlined text-lg">swap_vert</span>
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-2 text-red-500 bg-red-50 rounded-xl hover:bg-red-100"
                        title="Excluir"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-3xl p-12 text-center space-y-2 border-2 border-dashed border-gray-200">
          <span className="material-symbols-outlined text-4xl text-gray-300">hourglass_empty</span>
          <p className="text-gray-500 text-sm font-medium">Nenhuma pessoa aguardando na fila com os filtros selecionados.</p>
        </div>
      )}

      {/* Modais da Fila */}
      <ModalCadastroPessoa
        isOpen={isCadastroModalOpen}
        onClose={() => setIsCadastroModalOpen(false)}
        editingPerson={editingPerson}
        onSaved={handleSavedPessoa}
      />

      <ModalProgramarSessao
        isOpen={isProgramarModalOpen}
        onClose={() => setIsProgramarModalOpen(false)}
        person={programarPerson}
        onProgrammed={(msg) => {
          onShowToast(msg, 'success');
          loadData();
        }}
        onRequestUrgentBump={(bumpData) => {
          setUrgentBumpData(bumpData);
        }}
      />

      <ModalMoverPosicao
        isOpen={isMoveModalOpen}
        onClose={() => setIsMoveModalOpen(false)}
        person={movePerson}
        maxPosition={pessoas.length}
        onMoved={handleMovePos}
      />

      <ModalReorganizacaoUrgente
        isOpen={!!urgentBumpData}
        onClose={() => setUrgentBumpData(null)}
        onConfirm={handleConfirmUrgentBump}
        sessionInfo={urgentBumpData}
        lastNormalPerson={urgentBumpData?.lastNormalPerson}
      />
    </div>
  );
};

export default FilaEspera;
