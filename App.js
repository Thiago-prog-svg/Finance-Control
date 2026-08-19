import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { askClara } from "./src/services/ai";

const STORAGE_KEY = "clara-finance-data-v1";
const NUMERIC_ACCESSORY_ID = "clara-numeric-keyboard";

const initialMessages = [
  {
    role: "assistant",
    text: "Oi, eu sou a Clara. Cadastre seus ganhos, gastos e investimentos que eu te ajudo a enxergar o mes com clareza."
  }
];

const tabs = [
  { key: "home", label: "Resumo", icon: "home-outline" },
  { key: "spending", label: "Gastos", icon: "pie-chart-outline" },
  { key: "investments", label: "Investir", icon: "trending-up-outline" },
  { key: "assistant", label: "IA", icon: "sparkles-outline" }
];

const emptyEntry = {
  id: null,
  amount: "",
  category: "",
  name: "",
  note: "",
  type: "expense",
  date: ""
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toLocalDate(value) {
  const [year, month, day] = parseDate(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function parseDate(value) {
  const text = String(value || "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const brMatch = /^([0-3]\d)\/([0-1]\d)\/(\d{4})$/.exec(text);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return today();
}

function getMonthKey(value) {
  return parseDate(value).slice(0, 7);
}

function formatDate(value) {
  if (!value) {
    return "";
  }
  const date = toLocalDate(value);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatMonthLabel(value) {
  const date = toLocalDate(value);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric"
  }).format(date);
}

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [transactions, setTransactions] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [goal, setGoal] = useState({ target: 0, lazerBudget: 0 });
  const [messages, setMessages] = useState(initialMessages);
  const [prompt, setPrompt] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [modalMode, setModalMode] = useState(null);
  const [entry, setEntry] = useState(emptyEntry);
  const [goalDraft, setGoalDraft] = useState({ target: "", lazerBudget: "" });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ goal, investments, messages, transactions })
    ).catch(() => {});
  }, [goal, investments, messages, transactions, isReady]);

  const summary = useMemo(() => {
    const currentMonthKey = getMonthKey(today());
    const currentMonthTransactions = transactions.filter(
      (item) => getMonthKey(item.date || today()) === currentMonthKey
    );
    const income = transactions
      .filter((item) => item.type === "income")
      .reduce((total, item) => total + item.amount, 0);
    const expenses = transactions
      .filter((item) => item.type === "expense")
      .reduce((total, item) => total + item.amount, 0);
    const applications = transactions
      .filter((item) => item.type === "application")
      .reduce((total, item) => total + item.amount, 0);
    const invested = investments.reduce((total, item) => total + item.amount, 0);
    const applied = applications + invested;

    const currentMonthIncome = currentMonthTransactions
      .filter((item) => item.type === "income")
      .reduce((total, item) => total + item.amount, 0);
    const currentMonthApplications = currentMonthTransactions
      .filter((item) => item.type === "application")
      .reduce((total, item) => total + item.amount, 0);
    const currentMonthLazer = currentMonthTransactions
      .filter((item) => item.type === "expense")
      .filter((item) => item.category?.trim().toLowerCase() === "lazer")
      .reduce((total, item) => total + item.amount, 0);
    const currentMonthExpenses = currentMonthTransactions
      .filter((item) => item.type === "expense")
      .reduce((total, item) => total + item.amount, 0);

    return {
      applications,
      applied,
      available: currentMonthIncome - currentMonthExpenses - currentMonthApplications,
      currentMonthExpenses,
      currentMonthLabel: formatMonthLabel(today()),
      currentMonthLazer,
      expenses,
      goalPercent: goal.target > 0 ? Math.min(100, Math.round((applied / goal.target) * 100)) : 0,
      income,
      invested,
      lazerBudget: goal.lazerBudget,
      lazerRemaining: goal.lazerBudget > 0 ? Math.max(0, goal.lazerBudget - currentMonthLazer) : 0,
      netWorth: income - expenses + invested
    };
  }, [goal, investments, transactions]);

  async function loadData() {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);
        setTransactions(parsed.transactions || []);
        setInvestments(parsed.investments || []);
        setGoal({
          target: parsed.goal?.target || 0,
          lazerBudget: parsed.goal?.lazerBudget || 0
        });
        setMessages(parsed.messages?.length ? parsed.messages : initialMessages);
      }
    } catch (error) {
      Alert.alert("Clara Finance", "Nao consegui carregar os dados salvos.");
    } finally {
      setIsReady(true);
    }
  }

  function openNewEntry() {
    const nextMode = activeTab === "investments" ? "investment" : "transaction";
    setModalMode(nextMode);
    setEntry({
      ...emptyEntry,
      type: nextMode === "investment" ? "investment" : "expense",
      date: today()
    });
  }

  function openEditTransaction(item) {
    setModalMode("transaction");
    setEntry({
      ...item,
      amount: formatInputAmount(item.amount),
      date: item.date || today()
    });
  }

  function openEditInvestment(item) {
    setModalMode("investment");
    setEntry({
      ...item,
      amount: formatInputAmount(item.amount),
      type: "investment",
      date: item.date || today()
    });
  }

  function openGoal() {
    setGoalDraft({
      target: formatInputAmount(goal.target)
    });
    setModalMode("goal");
  }

  function saveEntry() {
    const amount = parseCurrency(entry.amount);
    const name = entry.name.trim();

    if (!name || amount <= 0) {
      Alert.alert("Falta informacao", "Preencha nome e valor para salvar.");
      return;
    }

    if (modalMode === "investment") {
      const investment = {
        id: entry.id || createId(),
        amount,
        category: entry.category.trim() || "Carteira",
        name,
        note: entry.note.trim(),
        date: parseDate(entry.date)
      };
      setInvestments((current) =>
        entry.id ? current.map((item) => (item.id === entry.id ? investment : item)) : [investment, ...current]
      );
    } else {
      const transaction = {
        id: entry.id || createId(),
        amount,
        category: entry.category.trim() || getDefaultCategory(entry.type),
        name,
        note: entry.note.trim(),
        type: entry.type,
        date: parseDate(entry.date)
      };
      setTransactions((current) =>
        entry.id ? current.map((item) => (item.id === entry.id ? transaction : item)) : [transaction, ...current]
      );
    }

    closeModal();
  }

  function deleteEntry() {
    if (!entry.id) {
      closeModal();
      return;
    }

    if (modalMode === "investment") {
      setInvestments((current) => current.filter((item) => item.id !== entry.id));
    } else {
      setTransactions((current) => current.filter((item) => item.id !== entry.id));
    }

    closeModal();
  }

  function saveGoal() {
    setGoal({
      target: parseCurrency(goalDraft.target),
      lazerBudget: parseCurrency(goalDraft.lazerBudget)
    });
    closeModal();
  }

  function closeModal() {
    setModalMode(null);
    setEntry(emptyEntry);
  }

  async function sendMessage() {
    const text = prompt.trim();

    if (!text || isThinking) {
      return;
    }

    const nextMessages = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setPrompt("");
    setIsThinking(true);

    const context = {
      available: summary.available,
      expenses: summary.currentMonthExpenses,
      income: summary.income,
      invested: summary.applied
    };
    const answer = await askClara(text, nextMessages, context);
    setMessages((current) => [...current, { role: "assistant", text: answer }]);
    setIsThinking(false);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ExpoStatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboard}
      >
        <View style={styles.shell}>
          <Header onAdd={openNewEntry} />
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {activeTab === "home" && (
              <HomeScreen
                goal={goal}
                onGoalPress={openGoal}
                summary={summary}
                transactions={transactions}
              />
            )}
            {activeTab === "spending" && (
              <SpendingScreen onEdit={openEditTransaction} transactions={transactions} />
            )}
            {activeTab === "investments" && (
              <InvestmentsScreen
                investments={investments}
                onEdit={openEditInvestment}
                onEditApplication={openEditTransaction}
                summary={summary}
                transactions={transactions}
              />
            )}
            {activeTab === "assistant" && (
              <AssistantScreen
                isThinking={isThinking}
                messages={messages}
                onSend={sendMessage}
                prompt={prompt}
                setPrompt={setPrompt}
              />
            )}
          </ScrollView>
          <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />
          <EntryModal
            entry={entry}
            modalMode={modalMode}
            onChange={setEntry}
            onClose={closeModal}
            onDelete={deleteEntry}
            onSave={saveEntry}
          />
          <GoalModal
            goalDraft={goalDraft}
            modalMode={modalMode}
            onChange={setGoalDraft}
            onClose={closeModal}
            onSave={saveGoal}
          />
          {Platform.OS === "ios" && (
            <InputAccessoryView nativeID={NUMERIC_ACCESSORY_ID}>
              <View style={styles.keyboardAccessory}>
                <Pressable onPress={Keyboard.dismiss} style={styles.keyboardDone}>
                  <Text style={styles.keyboardDoneText}>OK</Text>
                </Pressable>
              </View>
            </InputAccessoryView>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Header({ onAdd }) {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <View style={styles.mark}>
          <Text style={styles.markText}>C</Text>
        </View>
        <View>
          <Text style={styles.appName}>Clara Finance</Text>
          <Text style={styles.subtitle}>Seu copiloto financeiro</Text>
        </View>
      </View>
      <Pressable accessibilityLabel="Adicionar" onPress={onAdd} style={styles.circleButton}>
        <Ionicons color={colors.ink} name="add" size={24} />
      </Pressable>
    </View>
  );
}

function HomeScreen({ goal, onGoalPress, summary, transactions }) {
  const lastTransactions = transactions.slice(0, 3);

  return (
    <View>
      <View style={styles.hero}>
        <View>
          <Text style={styles.eyebrow}>Patrimonio total</Text>
          <Text style={styles.amount}>{formatCurrency(summary.netWorth)}</Text>
        </View>
        <View style={styles.heroFooter}>
          <Text style={styles.heroMuted}>{formatCurrency(summary.income)} em entradas</Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>meta {summary.goalPercent}%</Text>
          </View>
        </View>
      </View>

      <View style={styles.grid}>
        <MetricCard detail={summary.currentMonthLabel} tone="bad" title="Gastos do mes" value={formatCurrency(summary.currentMonthExpenses)} />
        <MetricCard detail="entradas - gastos" tone={summary.available >= 0 ? "good" : "bad"} title="Disponivel" value={formatCurrency(summary.available)} />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Lazer em {summary.currentMonthLabel}</Text>
        <Text style={styles.metric}>{formatCurrency(summary.currentMonthLazer)}</Text>
        <Text style={[styles.muted, summary.lazerBudget > 0 ? styles.good : null]}>
          {summary.lazerBudget > 0
            ? `Meta: ${formatCurrency(summary.lazerBudget)} • Restante: ${formatCurrency(summary.lazerRemaining)}`
            : "Defina um orçamento mensal de lazer nas metas."}
        </Text>
      </View>

      <SectionTitle title="IA percebeu" />
      <Insight
        icon={summary.available >= 0 ? "checkmark-outline" : "alert-outline"}
        title={summary.available >= 0 ? "Caixa positivo" : "Caixa negativo"}
        detail={
          transactions.length
            ? "A Clara ja consegue analisar seus lancamentos."
            : "Adicione o primeiro gasto ou entrada no botao +."
        }
        value={transactions.length ? "OK" : "Novo"}
        tone={summary.available >= 0 ? "good" : "bad"}
      />

      <SectionTitle title="Aplicados" />
      <Pressable onPress={onGoalPress} style={styles.card}>
        <View style={styles.row}>
          <View>
            <Text style={styles.itemTitle}>Total aplicado</Text>
            <Text style={styles.muted}>{formatCurrency(summary.applied)} de {formatCurrency(goal.target)}</Text>
          </View>
          <Text style={styles.itemTitle}>{summary.goalPercent}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${summary.goalPercent}%` }]} />
        </View>
      </Pressable>

      <SectionTitle title="Ultimos lancamentos" />
      {lastTransactions.length ? (
        <View style={styles.card}>
          {lastTransactions.map((item) => (
            <TransactionItem key={item.id} item={item} onPress={() => {}} />
          ))}
        </View>
      ) : (
        <EmptyState text="Nada cadastrado ainda. Toque no + para comecar." />
      )}
    </View>
  );
}

function SpendingScreen({ onEdit, transactions }) {
  const currentMonthKey = getMonthKey(today());
  const currentMonthTransactions = transactions.filter(
    (item) => getMonthKey(item.date || today()) === currentMonthKey
  );
  const expenses = currentMonthTransactions.filter((item) => item.type === "expense");
  const income = currentMonthTransactions.filter((item) => item.type === "income");
  const applications = currentMonthTransactions.filter((item) => item.type === "application");

  const months = transactions.reduce((acc, item) => {
    const monthKey = getMonthKey(item.date || today());
    const monthLabel = formatMonthLabel(item.date || today());

    if (!acc[monthKey]) {
      acc[monthKey] = {
        monthKey,
        monthLabel,
        items: [],
        expenseTotal: 0
      };
    }

    acc[monthKey].items.push(item);

    if (item.type === "expense") {
      acc[monthKey].expenseTotal += item.amount;
    }

    return acc;
  }, {});

  const monthGroups = Object.values(months).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

  return (
    <View>
      <ScreenTop title="Gastos" subtitle="Toque em um item para editar ou apagar" />
      <View style={styles.chips}>
        <View style={[styles.chip, styles.chipActive]}>
          <Text style={[styles.chipText, styles.chipTextActive]}>Gastos do mes {expenses.length}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipText}>Entradas {income.length}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipText}>Aplicados {applications.length}</Text>
        </View>
      </View>
      {monthGroups.length ? (
        <View>
          {monthGroups.map((group) => (
            <View key={group.monthKey} style={styles.monthGroup}>
              <View style={styles.monthHeader}>
                <Text style={styles.monthTitle}>{group.monthLabel}</Text>
                <Text style={styles.muted}>Gastos {formatCurrency(group.expenseTotal)}</Text>
              </View>
              <View style={styles.card}>
                {group.items.map((item) => (
                  <TransactionItem key={item.id} item={item} onPress={() => onEdit(item)} />
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState text="Sem gastos ainda. Toque no + para adicionar." />
      )}
    </View>
  );
}

function InvestmentsScreen({ investments, onEdit, onEditApplication, summary, transactions }) {
  const applications = transactions.filter((item) => item.type === "application");
  const hasItems = investments.length || applications.length;

  return (
    <View>
      <ScreenTop title="Investimentos" subtitle="Toque em um ativo para editar ou apagar" />
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Total investido</Text>
        <Text style={styles.cardAmount}>{formatCurrency(summary.applied)}</Text>
        <View style={styles.allocation}>
          <View style={[styles.allocationPart, { flex: hasItems ? 1 : 0, backgroundColor: colors.mint }]} />
        </View>
        <Text style={styles.muted}>{hasItems ? `${investments.length + applications.length} itens cadastrados` : "Carteira zerada"}</Text>
      </View>

      <SectionTitle title="Carteira" />
      {hasItems ? (
        <View style={styles.card}>
          {applications.map((item) => (
            <AssetItem
              key={item.id}
              item={{ ...item, category: item.category || "Aplicacao" }}
              onPress={() => onEditApplication(item)}
            />
          ))}
          {investments.map((item) => (
            <AssetItem key={item.id} item={item} onPress={() => onEdit(item)} />
          ))}
        </View>
      ) : (
        <EmptyState text="Nenhum investimento ainda. Toque no + para cadastrar." />
      )}
    </View>
  );
}

function AssistantScreen({ isThinking, messages, onSend, prompt, setPrompt }) {
  return (
    <View>
      <ScreenTop title="IA" subtitle="Pergunte sobre dinheiro em linguagem natural" />
      <View style={styles.chat}>
        {messages.map((message, index) => (
          <View
            key={`${message.role}-${index}`}
            style={[styles.message, message.role === "user" ? styles.userMessage : styles.aiMessage]}
          >
            <Text style={[styles.messageText, message.role === "user" && styles.userMessageText]}>
              {message.text}
            </Text>
          </View>
        ))}
        {isThinking && (
          <View style={[styles.message, styles.aiMessage]}>
            <Text style={styles.messageText}>Pensando no seu dinheiro...</Text>
          </View>
        )}
      </View>
      <View style={styles.composer}>
        <TextInput
          onChangeText={setPrompt}
          onSubmitEditing={onSend}
          placeholder="Pergunte a Clara"
          placeholderTextColor={colors.muted}
          returnKeyType="send"
          style={styles.input}
          value={prompt}
        />
        <Pressable accessibilityLabel="Enviar mensagem" onPress={onSend} style={styles.sendButton}>
          <Ionicons color={colors.mint} name="arrow-forward" size={22} />
        </Pressable>
      </View>
    </View>
  );
}

function EntryModal({ entry, modalMode, onChange, onClose, onDelete, onSave }) {
  const isVisible = modalMode === "transaction" || modalMode === "investment";
  const isInvestment = modalMode === "investment";

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={isVisible}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isInvestment ? "Investimento" : "Lancamento"}</Text>
            <Pressable onPress={onClose} style={styles.iconOnly}>
              <Ionicons color={colors.muted} name="close" size={24} />
            </Pressable>
          </View>

          {!isInvestment && (
            <View style={styles.segmented}>
              <Pressable
                onPress={() => onChange({ ...entry, type: "expense" })}
                style={[styles.segment, entry.type === "expense" && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, entry.type === "expense" && styles.segmentTextActive]}>Gasto</Text>
              </Pressable>
              <Pressable
                onPress={() => onChange({ ...entry, type: "income" })}
                style={[styles.segment, entry.type === "income" && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, entry.type === "income" && styles.segmentTextActive]}>Entrada</Text>
              </Pressable>
              <Pressable
                onPress={() => onChange({ ...entry, type: "application" })}
                style={[styles.segment, entry.type === "application" && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, entry.type === "application" && styles.segmentTextActive]}>Aplicacao</Text>
              </Pressable>
            </View>
          )}

          <Field
            label={isInvestment ? "Nome do ativo" : "Nome"}
            onChangeText={(name) => onChange({ ...entry, name })}
            placeholder={isInvestment ? "Tesouro Selic, CDB, acao..." : "Mercado, salario, aluguel..."}
            value={entry.name}
          />
          <Field
            keyboardType="decimal-pad"
            label="Valor"
            onChangeText={(amount) => onChange({ ...entry, amount })}
            placeholder="0,00"
            value={entry.amount}
          />
          <Field
            label="Data"
            onChangeText={(date) => onChange({ ...entry, date })}
            placeholder="AAAA-MM-DD"
            value={entry.date}
          />
          <Field
            label={isInvestment ? "Tipo" : "Categoria"}
            onChangeText={(category) => onChange({ ...entry, category })}
            placeholder={isInvestment ? "Renda fixa, ETF, acao..." : "Moradia, comida, lazer..."}
            value={entry.category}
          />
          <Field
            label="Observacao"
            onChangeText={(note) => onChange({ ...entry, note })}
            placeholder="Opcional"
            value={entry.note}
          />

          <View style={styles.modalActions}>
            {entry.id && (
              <Pressable onPress={onDelete} style={[styles.actionButton, styles.deleteButton]}>
                <Text style={styles.deleteText}>Apagar</Text>
              </Pressable>
            )}
            <Pressable onPress={onSave} style={[styles.actionButton, styles.saveButton]}>
              <Text style={styles.saveText}>Salvar</Text>
            </Pressable>
          </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function GoalModal({ goalDraft, modalMode, onChange, onClose, onSave }) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={modalMode === "goal"}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Meta de aplicados</Text>
            <Pressable onPress={onClose} style={styles.iconOnly}>
              <Ionicons color={colors.muted} name="close" size={24} />
            </Pressable>
          </View>
          <Field
            keyboardType="decimal-pad"
            label="Meta de aplicados"
            onChangeText={(target) => onChange({ ...goalDraft, target })}
            placeholder="0,00"
            value={goalDraft.target}
          />
          <Field
            keyboardType="decimal-pad"
            label="Orcamento mensal de lazer"
            onChangeText={(lazerBudget) => onChange({ ...goalDraft, lazerBudget })}
            placeholder="0,00"
            value={goalDraft.lazerBudget}
          />
          <Pressable onPress={onSave} style={[styles.actionButton, styles.saveButton]}>
            <Text style={styles.saveText}>Salvar meta</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, ...props }) {
  const numericProps =
    props.keyboardType === "decimal-pad" || props.keyboardType === "numeric"
      ? { inputAccessoryViewID: NUMERIC_ACCESSORY_ID }
      : {};

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={styles.fieldInput} {...numericProps} {...props} />
    </View>
  );
}

function MetricCard({ detail, title, tone, value }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{title}</Text>
      <Text style={styles.metric}>{value}</Text>
      <Text style={[styles.muted, tone === "good" ? styles.good : styles.bad]}>{detail}</Text>
    </View>
  );
}

function Insight({ detail, icon, title, tone, value }) {
  return (
    <View style={styles.insight}>
      <View style={styles.bubble}>
        <Ionicons color={colors.ink} name={icon} size={19} />
      </View>
      <View style={styles.insightText}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.muted}>{detail}</Text>
      </View>
      <Text style={[styles.itemTitle, tone === "good" ? styles.good : styles.bad]}>{value}</Text>
    </View>
  );
}

function TransactionItem({ item, onPress }) {
  const isIncome = item.type === "income";
  const isApplication = item.type === "application";

  return (
    <Pressable onPress={onPress} style={styles.listItem}>
      <View style={styles.bubble}>
        <Ionicons
          color={colors.ink}
          name={isIncome ? "arrow-down-outline" : isApplication ? "trending-up-outline" : "arrow-up-outline"}
          size={19}
        />
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemTitle}>{item.name}</Text>
        <Text style={styles.muted}>{item.category} · {formatDate(item.date)}</Text>
      </View>
      <Text style={[styles.itemTitle, isIncome || isApplication ? styles.good : styles.bad]}>
        {isIncome ? "+" : isApplication ? ">" : "-"} {formatCurrency(item.amount)}
      </Text>
    </Pressable>
  );
}

function AssetItem({ item, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.listItem}>
      <View style={styles.bubble}>
        <Text style={styles.bubbleLabel}>{item.category.slice(0, 2).toUpperCase() || "IN"}</Text>
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemTitle}>{item.name}</Text>
        <Text style={styles.muted}>{item.category}</Text>
      </View>
      <Text style={[styles.itemTitle, styles.good]}>{formatCurrency(item.amount)}</Text>
    </Pressable>
  );
}

function EmptyState({ text }) {
  return (
    <View style={styles.empty}>
      <Ionicons color={colors.muted} name="add-circle-outline" size={28} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function SectionTitle({ title }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function ScreenTop({ subtitle, title }) {
  return (
    <View style={styles.screenTop}>
      <Text style={styles.screenTitle}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

function TabBar({ activeTab, setActiveTab }) {
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === tab.key }}
          key={tab.key}
          onPress={() => setActiveTab(tab.key)}
          style={[styles.tab, activeTab === tab.key && styles.activeTab]}
        >
          <Ionicons color={activeTab === tab.key ? colors.ink : colors.muted} name={tab.icon} size={21} />
          <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDefaultCategory(type) {
  if (type === "income") {
    return "Receita";
  }

  if (type === "application") {
    return "Aplicacao";
  }

  return "Geral";
}

function parseCurrency(value) {
  if (typeof value === "number") {
    return value;
  }

  const normalized = String(value || "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  return Number(normalized) || 0;
}

function formatInputAmount(value) {
  if (!value) {
    return "";
  }

  return String(value).replace(".", ",");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency"
  }).format(value || 0);
}

const colors = {
  ink: "#161616",
  muted: "#6d6a64",
  line: "#e7e1d8",
  paper: "#fffaf2",
  surface: "#ffffff",
  coal: "#20201d",
  mint: "#b8f2d1",
  green: "#16824b",
  red: "#c84c4c"
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0
  },
  keyboard: {
    flex: 1
  },
  shell: {
    flex: 1,
    backgroundColor: colors.paper
  },
  header: {
    alignItems: "center",
    borderBottomColor: "rgba(231, 225, 216, 0.75)",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingVertical: 14
  },
  brand: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  mark: {
    alignItems: "center",
    backgroundColor: colors.coal,
    borderRadius: 17,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  markText: {
    color: colors.mint,
    fontSize: 16,
    fontWeight: "900"
  },
  appName: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800"
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2
  },
  circleButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 19,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  content: {
    paddingBottom: 104,
    paddingHorizontal: 18,
    paddingTop: 18
  },
  hero: {
    backgroundColor: "#1d1d1b",
    borderRadius: 8,
    minHeight: 178,
    justifyContent: "space-between",
    overflow: "hidden",
    padding: 20
  },
  eyebrow: {
    color: "rgba(255, 248, 234, 0.72)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  amount: {
    color: "#fff8ea",
    fontSize: 38,
    fontWeight: "900",
    marginTop: 8
  },
  heroFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  heroMuted: {
    color: "rgba(255, 248, 234, 0.72)",
    fontSize: 12
  },
  pill: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  pillText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800"
  },
  grid: {
    flexDirection: "row",
    gap: 10,
    marginVertical: 12
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 14
  },
  cardLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8
  },
  metric: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: "900"
  },
  good: {
    color: colors.green
  },
  bad: {
    color: colors.red
  },
  muted: {
    color: colors.muted,
    fontSize: 12
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 10,
    marginHorizontal: 2,
    marginTop: 22
  },
  insight: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
    padding: 12
  },
  bubble: {
    alignItems: "center",
    backgroundColor: "#f3eadc",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  bubbleLabel: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900"
  },
  insightText: {
    flex: 1
  },
  itemTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800"
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  progressTrack: {
    backgroundColor: "#efe7db",
    borderRadius: 99,
    height: 8,
    marginTop: 10,
    overflow: "hidden"
  },
  progressFill: {
    backgroundColor: colors.mint,
    borderRadius: 99,
    height: 8
  },
  screenTop: {
    marginBottom: 14
  },
  screenTitle: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900"
  },
  chips: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14
  },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  chipActive: {
    backgroundColor: colors.coal,
    borderColor: colors.coal
  },
  chipText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  chipTextActive: {
    color: "#fff8ea"
  },
  monthGroup: {
    marginBottom: 18
  },
  monthHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8
  },
  monthTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  listItem: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingVertical: 13
  },
  itemBody: {
    flex: 1
  },
  cardAmount: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "900"
  },
  allocation: {
    backgroundColor: "#efe7db",
    borderRadius: 999,
    flexDirection: "row",
    height: 18,
    marginBottom: 4,
    marginTop: 14,
    overflow: "hidden"
  },
  allocationPart: {
    height: 18
  },
  chat: {
    gap: 10,
    minHeight: 430
  },
  message: {
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: "84%",
    paddingHorizontal: 13,
    paddingVertical: 12
  },
  aiMessage: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: colors.coal,
    borderColor: colors.coal
  },
  messageText: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 19
  },
  userMessageText: {
    color: "#fff8ea"
  },
  composer: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: colors.coal,
    borderRadius: 21,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  empty: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 22
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center"
  },
  modalBackdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    flex: 1,
    justifyContent: "flex-end"
  },
  modalSheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900"
  },
  iconOnly: {
    padding: 6
  },
  segmented: {
    backgroundColor: "#f3eadc",
    borderRadius: 999,
    flexDirection: "row",
    marginBottom: 14,
    padding: 4
  },
  segment: {
    alignItems: "center",
    borderRadius: 999,
    flex: 1,
    paddingVertical: 10
  },
  segmentActive: {
    backgroundColor: colors.coal
  },
  segmentText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  segmentTextActive: {
    color: "#fff8ea"
  },
  field: {
    marginBottom: 12
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6
  },
  fieldInput: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4
  },
  actionButton: {
    alignItems: "center",
    borderRadius: 999,
    flex: 1,
    paddingVertical: 14
  },
  saveButton: {
    backgroundColor: colors.coal
  },
  deleteButton: {
    backgroundColor: "#f8dfdf"
  },
  saveText: {
    color: colors.mint,
    fontSize: 15,
    fontWeight: "900"
  },
  deleteText: {
    color: colors.red,
    fontSize: 15,
    fontWeight: "900"
  },
  tabBar: {
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderColor: "rgba(231, 225, 216, 0.86)",
    borderRadius: 24,
    borderWidth: 1,
    bottom: 16,
    flexDirection: "row",
    gap: 4,
    height: 66,
    left: 18,
    padding: 6,
    position: "absolute",
    right: 18
  },
  tab: {
    alignItems: "center",
    borderRadius: 18,
    flex: 1,
    gap: 2,
    justifyContent: "center"
  },
  activeTab: {
    backgroundColor: "#f3eadc"
  },
  tabText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  activeTabText: {
    color: colors.ink
  }
});
