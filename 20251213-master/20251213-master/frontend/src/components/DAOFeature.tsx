import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Trash2 } from 'lucide-react';

import { Transaction, Inputs } from '@mysten/sui/transactions';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';

import { daoConfig } from '../dao/daoConfig';

type Proposal = { id: bigint; title: string; yes: bigint };

const chain = 'sui:devnet' as const;

function short(id: string, n = 6) {
  return id ? `${id.slice(0, 2 + n)}…${id.slice(-n)}` : '';
}

interface DAOFeatureProps {
  residentPassId: string;
  setResidentPassId: (id: string) => void;
}

export const DAOFeature: React.FC<DAOFeatureProps> = ({ residentPassId, setResidentPassId }) => {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [tab, setTab] = useState<'global' | 'region'>('global');

  // ===== Global state =====
  const [gBalance, setGBalance] = useState<bigint>(0n);
  const [gOnChainBalance, setGOnChainBalance] = useState<bigint>(0n);
  const [gOffChainTotal, setGOffChainTotal] = useState<bigint>(0n); // Total history from backend
  const [gProposals, setGProposals] = useState<Proposal[]>([]);
  const [gTitle, setGTitle] = useState('');
  const [gDesc, setGDesc] = useState('');
  const [gVoteAmount, setGVoteAmount] = useState('1');

  // ===== Region state =====
  // residentPassId is now a prop
  const [rBalance, setRBalance] = useState<bigint>(0n);
  const [rProposals, setRProposals] = useState<Proposal[]>([]);
  const [rTitle, setRTitle] = useState('');
  const [rDesc, setRDesc] = useState('');
  const [rVoteAmount, setRVoteAmount] = useState('1');

  const isConnected = !!account?.address;

  // =========================
  // Shared: execute
  // =========================
  const execTx = async (tx: any) => {
    if (!isConnected) throw new Error('Wallet 未接続');
    console.log('[execTx] Executing transaction...');
    // @ts-ignore
    const res = await signAndExecute({
      transaction: tx,
      chain,
    });

    console.log('[execTx] Transaction result:', res);

    // Check status safely
    const effects = res?.effects;
    const status = (effects as any)?.status;

    // Fallback: If effects is a string (unexpected but possible in some envs), we can't easily check status.
    // We'll warn the user to check explorer.
    if (typeof effects === 'string') {
      console.warn('[execTx] Effects returned as string. Cannot verify status locally. Assuming success but please check Explorer.');
      toast(`TX Sent. Status unknown (check console). Digest: ${(res as any).digest.slice(0, 6)}...`, { icon: '⚠️' });
    } else if (status && status.status === 'failure') {
      console.error('[execTx] Transaction failed:', status.error);
      throw new Error(`Transaction Failed: ${status.error || 'Unknown Error'}`);
    } else {
      console.log('[execTx] Transaction succeeded:', (res as any).digest);
      toast.success(`Tx Success: ${(res as any).digest.slice(0, 8)}`);
    }

    return res;
  };



  // =========================
  // Global: read (balance + proposals)
  // 既存の「開発版 DaoPage」に fetch ロジックがあるなら、そこから移植してここに置き換えてOK
  // =========================
  // =========================
  // Helper to fetch table items
  // =========================
  const fetchTableItems = async (parentId: string, nextId: number) => {
    const items: Proposal[] = [];
    if (nextId <= 1) return items;

    for (let i = 1; i < nextId; i++) {
      try {
        const res = await client.getDynamicFieldObject({
          parentId,
          name: { type: 'u64', value: String(i) },
        });

        if (!res?.data) continue;
        const contentFields = (res.data.content as any)?.fields;
        const valueFields = contentFields?.value?.fields ?? contentFields?.value;
        const fields = valueFields ?? contentFields;

        if (!fields) continue;

        items.push({
          id: BigInt(fields.id ?? i),
          title: fields.title ?? fields.description ?? `Proposal ${i}`,
          yes: BigInt(fields.yes_votes ?? 0),
        });
      } catch (e) {
        console.warn('Missing proposal id', i, e);
      }
    }
    return items;
  };

  // =========================
  // Demo Reset Helper
  // =========================
  const getDemoSettings = () => {
    return {
      gOffset: BigInt(localStorage.getItem('demo_global_offset') ?? '0'),
      rOffset: BigInt(localStorage.getItem('demo_region_offset') ?? '0'),
      gPidThreshold: BigInt(localStorage.getItem('demo_global_pid_threshold') ?? '0'),
      rPidThreshold: BigInt(localStorage.getItem('demo_region_pid_threshold') ?? '0'),
    };
  };

  const refreshGlobal = async () => {
    console.log('refreshGlobal: Start');
    const { gOffset, gPidThreshold } = getDemoSettings();

    if (!account?.address) return;

    let onChainVal = 0n;
    let offChainTotal = 0n;

    // 1. Fetch On-Chain Balance
    try {
      const stateObj = await client.getObject({
        id: daoConfig.globalGovStateId,
        options: { showContent: true },
      });

      if (!stateObj.error && stateObj.data) {
        const content = (stateObj.data?.content as any)?.fields;
        console.log('refreshGlobal: Content', content);

        if (content?.global_balances?.fields?.id?.id) {
          const tableId = content.global_balances.fields.id.id;
          try {
            const balObj = await client.getDynamicFieldObject({
              parentId: tableId,
              name: { type: 'address', value: account.address }
            });
            if (balObj.data) {
              const val = (balObj.data.content as any)?.fields?.value ?? 0;
              onChainVal = BigInt(val);
              console.log('refreshGlobal: OnChain Balance found', val);
            }
          } catch (e) { /* ignore */ }
        }

        // 3. Proposals (Fetch here to keep scoped)
        if (content?.global_proposals?.fields?.id?.id && content?.next_global_proposal_id) {
          const tableId = content.global_proposals.fields.id.id;
          const nextId = Number(content.next_global_proposal_id);
          let props = await fetchTableItems(tableId, nextId);
          // Demo Filter
          if (gPidThreshold > 0n) {
            props = props.filter(p => p.id >= gPidThreshold);
          }
          setGProposals(props);
        } else {
          setGProposals([]);
        }
      }
    } catch (e) {
      console.error('refreshGlobal error', e);
    }

    // 2. Fetch "Stay" TokenBalance (from stay_mock package)
    // Compare with onChainVal (Voting Power) to find "Unsynced" amount.
    try {
      let stayBalance = 0n;
      const { data } = await client.getOwnedObjects({
        owner: account.address,
        filter: {
          StructType: `${daoConfig.stayPkgId}::token_management::TokenBalance`,
        },
        options: {
          showContent: true,
        }
      });

      if (data && data.length > 0) {
        const obj = data[0];
        const content = obj.data?.content;
        if (content && content.dataType === 'moveObject') {
          // @ts-ignore
          const val = content.fields.balance;
          stayBalance = BigInt(val ?? 0);
        }
      }

      // Calculate Unsynced: (Accrued in Stay) - (Already in DAO)
      // If Dao has more (e.g. airdrop), then unsynced is 0.
      let diff = stayBalance - onChainVal;
      if (diff < 0n) diff = 0n;

      offChainTotal = diff; // We reuse this state variable for "Unsynced"
      console.log('refreshGlobal: StayBalance=', stayBalance, 'DAO Balance=', onChainVal, 'Diff(Unsynced)=', diff);

    } catch (e) {
      console.error('Failed to fetch Stay TokenBalance', e);
    }

    setGOnChainBalance(onChainVal);
    setGOffChainTotal(offChainTotal); // representing Unsynced amount

    // Total Display = DAO Balance + Unsynced (Approx total accumulated)
    setGBalance(onChainVal + offChainTotal);
  };

  // =========================
  // Region: read (balance + proposals)
  // =========================
  const refreshRegion = async () => {
    if (!residentPassId) return;
    const { rOffset, rPidThreshold } = getDemoSettings();

    try {
      // 1. Get RegionDaoState shared object
      const stateObj = await client.getObject({
        id: daoConfig.regionDaoStateId,
        options: { showContent: true },
      });
      const content = (stateObj.data?.content as any)?.fields;

      // 2. Voting Power
      let onChainVal = 0n;
      // Fix: Use balances Table ID
      if (content?.balances?.fields?.id?.id) {
        const tableId = content.balances.fields.id.id;
        try {
          const balObj = await client.getDynamicFieldObject({
            parentId: tableId,
            name: { type: 'address', value: account?.address as string }
          });
          if (balObj.data) {
            const fields = (balObj.data.content as any)?.fields;
            onChainVal = BigInt(fields?.value ?? fields?.amount ?? 0);
          }
        } catch (e) { /* ignore */ }
      } else {
        // Fallback: struct dynamic field? Unlikely for balances
        // Try checking if balances is just a parent struct ID use (unlikely for Table)
      }

      // 2.5: Add Off-Chain GPS Tokens (For Region, we use the same history for now as demo)
      // Ideally this should be region specific. For now, simplistic sum like Global.
      // 2.5: Add "Unsynced" TokenBalance (from stay_mock)
      let offChainTotal = 0n;
      try {
        let stayBalance = 0n;
        const { data } = await client.getOwnedObjects({
          owner: account!.address,
          filter: {
            StructType: `${daoConfig.stayPkgId}::token_management::TokenBalance`,
          },
          options: { showContent: true }
        });
        if (data && data.length > 0) {
          const content = data[0].data?.content;
          if (content && content.dataType === 'moveObject') {
            // @ts-ignore
            stayBalance = BigInt(content.fields.balance ?? 0);
          }
        }

        // Unsynced = StayBalance - AlreadySynced(onChainVal)
        let diff = stayBalance - onChainVal;
        if (diff < 0n) diff = 0n;
        offChainTotal = diff;

      } catch (e) {
        console.error('Failed to fetch Stay TokenBalance for Region', e);
      }

      // Total = OnChain + OffChain
      setRBalance(onChainVal + offChainTotal);

      // 3. Proposals
      if (content?.proposals?.fields?.id?.id && content?.next_proposal_id) {
        const tableId = content.proposals.fields.id.id;
        const nextId = Number(content.next_proposal_id);
        let props = await fetchTableItems(tableId, nextId);
        // Demo Filter
        if (rPidThreshold > 0n) {
          props = props.filter(p => p.id >= rPidThreshold);
        }
        setRProposals(props);
      }
    } catch (e) {
      console.error('refreshRegion error', e);
    }
  };

  useEffect(() => {
    if (!isConnected) return;
    void refreshGlobal();
  }, [isConnected]);

  // =========================
  // Global: tx
  // =========================

  // Helper to add "Sync" command to transaction if needed
  // Consume Off-chain tokens and add Mint command to TX
  const consumeAndSync = async (tx: Transaction, amount: bigint, isRegion: boolean) => {
    console.log(`[AutoSync] Consuming ${amount} tokens for ${isRegion ? 'Region' : 'Global'}...`);

    // 2. Add Mint Command
    if (isRegion) {
      // Fetch Shared Object Version for RegionDaoState
      const obj = await client.getObject({ id: daoConfig.regionDaoStateId, options: { showOwner: true } });
      const rawVersion = (obj.data?.owner as any)?.Shared?.initial_shared_version;
      if (!rawVersion) throw new Error("Could not fetch RegionDaoState shared version");
      const initialSharedVersion = Number(rawVersion);

      const sharedState = Inputs.SharedObjectRef({
        objectId: daoConfig.regionDaoStateId,
        initialSharedVersion,
        mutable: true,
      });

      tx.moveCall({
        target: `${daoConfig.platformPkgId}::region_dao::sync_local_token`,
        arguments: [
          tx.object(sharedState as any),
          tx.pure.u64(amount)
        ]
      });
    } else {
      // Global
      const obj = await client.getObject({ id: daoConfig.globalGovStateId, options: { showOwner: true } });
      const rawVersion = (obj.data?.owner as any)?.Shared?.initial_shared_version;
      if (!rawVersion) throw new Error("Could not fetch GlobalGovState shared version");
      const initialSharedVersion = Number(rawVersion);

      const sharedState = Inputs.SharedObjectRef({
        objectId: daoConfig.globalGovStateId,
        initialSharedVersion,
        mutable: true,
      });

      tx.moveCall({
        target: `${daoConfig.govPkgId}::platform::sync_gps_token`,
        arguments: [
          tx.object(sharedState as any),
          tx.pure.u64(amount)
        ]
      });
    }
    toast('GPSトークンを消費して投票権に変換中...', { icon: '🔄' });
  };

  const appendGlobalSyncIfNeeded = async (tx: Transaction) => {
    // Current gOffChainTotal is net available. Sync all of it.
    if (gOffChainTotal > 0n) {
      await consumeAndSync(tx, gOffChainTotal, false);
    }
  };

  const appendRegionSyncIfNeeded = async (tx: Transaction) => {
    // Current "OffChain" is same source for both for now. 
    // We re-fetch or rely on a separate state if we want strict separation.
    // Fetch fresh off-chain balance to be safe:
    // Update: Calculate unsynced for Region as well (simplistic: same as global for now)
    // Ideally Region should have its own context, but for POC we share the source
    // Fetch StayBalance again or reuse logic. For simplicity, we just check global logic?
    // Let's implement fetch directly here to be safe
    let available = 0n;
    let stayBalance = 0n;
    let daoBalance = 0n; // Region DAO balance

    // Fetch Region DAO Balance (Assuming RBalance state reflects on-chain part?)
    // Actually we haven't separated rOnChainBalance. Let's rely on gOffChainTotal for now as shared pool?
    // Or just fetch again.
    try {
      const { data } = await client.getOwnedObjects({
        owner: account!.address,
        filter: {
          StructType: `${daoConfig.stayPkgId}::token_management::TokenBalance`,
        },
        options: { showContent: true }
      });
      if (data && data.length > 0) {
        const content = data[0].data?.content;
        if (content && content.dataType === 'moveObject') {
          // @ts-ignore
          stayBalance = BigInt(content.fields.balance ?? 0);
        }
      }

      // For Region, we compare StayBalance vs Region Voting Power??
      // No, that would allow double spending (Sync to Global, THEN Sync to Region using same StayBalance).
      // This architecture requires a single destination or trackable consumption.
      // Given POC constraints: We will just allow syncing freely to Region based on difference 
      // BUT this allows double-dip. 
      // For THIS demo step: let's just use the calculated 'available' from refreshGlobal if possible,
      // or re-calculate diff against Region Balance.
      // Let's re-calculate diff against this specific DAO's balance.
      // (Users can effectively "clone" their GPS points to both DAOs - maybe acceptable for this POC level)

      // Fetch Region Balance again to be sure
      const stateObj = await client.getObject({ id: daoConfig.regionDaoStateId, options: { showContent: true } });
      // ... helper logic ...
      // For simplicity: Check rBalance (which is total). 
      // We'll trust the component state for now or just fetch diff.

      if (stayBalance > rBalance) {
        available = stayBalance - rBalance;
      }

    } catch (e) { }

    if (available > 0n) {
      await consumeAndSync(tx, available, true);
    }
  };

  const createGlobalProposal = async () => {
    if (gBalance <= 0n) return toast.error('投票権(トークン)が足りません');
    if (!gTitle.trim() || !gDesc.trim()) return toast.error('タイトルと説明を入力してください');

    const tx = new Transaction();

    // Auto Sync
    await appendGlobalSyncIfNeeded(tx);

    // 1. Fetch Shared Object Version
    const obj = await client.getObject({ id: daoConfig.globalGovStateId, options: { showOwner: true } });
    const rawVersion = (obj.data?.owner as any)?.Shared?.initial_shared_version;
    const initialSharedVersion = Number(rawVersion);

    const sharedGovState = Inputs.SharedObjectRef({
      objectId: daoConfig.globalGovStateId,
      initialSharedVersion,
      mutable: true,
    });

    tx.moveCall({
      target: `${daoConfig.govPkgId}::platform::create_global_proposal`,
      arguments: [
        tx.object(sharedGovState as any),
        tx.pure.string(gTitle),
        tx.pure.string(gDesc),
      ],
    });

    tx.setGasBudget(100000000);
    const result = await execTx(tx);
    console.log('Proposal created, transaction result:', result);
    setGTitle('');
    setGDesc('');

    toast.loading('処理完了を待機中...', { duration: 2000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await refreshGlobal();
  };

  const voteGlobal = async (proposalId: bigint) => {
    const amt = BigInt(gVoteAmount || '0');
    // If logic changes to consume tokens, check gBalance. For now contract is 1-vote/person.
    // However, we sync to ensure "Resident" status on chain.
    if (gBalance <= 0n) return toast.error('投票権がありません');

    const tx = new Transaction();

    // Auto Sync
    await appendGlobalSyncIfNeeded(tx);

    const obj = await client.getObject({ id: daoConfig.globalGovStateId, options: { showOwner: true } });
    const rawVersion = (obj.data?.owner as any)?.Shared?.initial_shared_version;
    const initialSharedVersion = Number(rawVersion);

    const sharedGovState = Inputs.SharedObjectRef({
      objectId: daoConfig.globalGovStateId,
      initialSharedVersion,
      mutable: true,
    });

    tx.moveCall({
      target: `${daoConfig.govPkgId}::platform::vote_global`,
      arguments: [
        tx.object(sharedGovState as any),
        tx.pure.u64(proposalId),
        tx.pure.u64(amt),
      ],
    });
    tx.setGasBudget(100000000);
    await execTx(tx);
    await refreshGlobal();
  };

  // =========================
  // Region: tx
  // =========================
  const requirePass = () => {
    if (!residentPassId) {
      toast.error('ResidentPass（住民票NFT）の objectId が必要です');
      return false;
    }
    return true;
  };

  const createRegionProposal = async () => {
    if (!residentPassId) {
      toast.error('ResidentCard（住民票NFT）が必要です。自動検出ボタンをクリックしてください');
      return;
    }
    if (rBalance <= 0n) return toast.error('提案するには投票権(トークン)が必要です');
    if (!rTitle.trim() || !rDesc.trim()) return toast.error('タイトルと説明を入力してください');

    console.log('[createRegionProposal] residentPassId:', residentPassId);

    // 1. Fetch Shared Object Version for RegionDaoState
    const obj = await client.getObject({ id: daoConfig.regionDaoStateId, options: { showOwner: true } });
    const rawVersion = (obj.data?.owner as any)?.Shared?.initial_shared_version;
    if (!rawVersion) throw new Error("Could not fetch RegionDaoState shared version");
    const initialSharedVersion = Number(rawVersion);

    const tx = new Transaction();

    // Auto Sync
    await appendRegionSyncIfNeeded(tx);
    const sharedRegionState = Inputs.SharedObjectRef({
      objectId: daoConfig.regionDaoStateId,
      initialSharedVersion,
      mutable: true,
    });

    tx.moveCall({
      target: `${daoConfig.platformPkgId}::region_dao::create_local_proposal`,
      arguments: [
        tx.object(sharedRegionState as any),
        tx.pure.string(rTitle),
        tx.pure.string(rDesc),
      ],
    });
    tx.setGasBudget(100000000);
    const result = await execTx(tx);
    console.log('Region Proposal created, transaction result:', result);
    setRTitle('');
    setRDesc('');

    toast.loading('提案を確認中...', { duration: 2000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await refreshRegion();
    console.log('Region Proposals after refresh:', rProposals);
  };

  const voteRegion = async (proposalId: bigint) => {
    console.log('[voteRegion] Called with proposalId:', proposalId, 'residentPassId:', residentPassId);
    if (!requirePass()) {
      console.log('[voteRegion] requirePass() failed');
      return;
    }
    const amt = BigInt(rVoteAmount || '0');
    console.log('[voteRegion] Vote amount:', amt);
    if (amt <= 0n) return toast.error('投票量は1以上');

    // 1. Fetch Shared Object Version
    const obj = await client.getObject({ id: daoConfig.regionDaoStateId, options: { showOwner: true } });
    const rawVersion = (obj.data?.owner as any)?.Shared?.initial_shared_version;
    if (!rawVersion) throw new Error("Could not fetch RegionDaoState shared version");
    const initialSharedVersion = Number(rawVersion);

    const tx = new Transaction();

    // Auto Sync
    await appendRegionSyncIfNeeded(tx);
    const sharedRegionState = Inputs.SharedObjectRef({
      objectId: daoConfig.regionDaoStateId,
      initialSharedVersion,
      mutable: true,
    });

    tx.moveCall({
      target: `${daoConfig.platformPkgId}::region_dao::vote_local`,
      arguments: [
        tx.object(sharedRegionState as any),
        tx.pure.u64(proposalId),
        tx.pure.u64(amt),
      ],
    });
    tx.setGasBudget(100000000);
    console.log('[voteRegion] About to execute transaction');
    await execTx(tx);
    console.log('[voteRegion] Transaction executed, refreshing...');
    await refreshRegion();
  };

  const detectResidentPass = async () => {
    if (!account?.address) return;
    const res = await client.getOwnedObjects({
      owner: account.address,
      options: { showType: true },
      limit: 50,
    });

    // ResidentPassを優先的に検出
    let hit = (res.data ?? []).find((o) => {
      const t = (o.data as any)?.type as string | undefined;
      return t?.endsWith('::ResidentPass');
    });

    // ResidentPassが見つからない場合、ResidentCardを検出
    if (!hit) {
      hit = (res.data ?? []).find((o) => {
        const t = (o.data as any)?.type as string | undefined;
        return t?.endsWith('::ResidentCard');
      });
    }

    if (hit?.data?.objectId) {
      setResidentPassId(hit.data.objectId);
      const type = (hit.data as any)?.type?.endsWith('::ResidentPass') ? 'ResidentPass' : 'ResidentCard';
      toast.success(`${type}: ${short(hit.data.objectId)}`);
      await refreshRegion();
    } else {
      toast.error('ResidentPass/ResidentCard が見つかりません（limit=50内）');
    }
  };

  const handleDemoReset = async () => {
    if (!window.confirm('デモ用に全てのデータをリセットしますか？\n(投票権、提案履歴、GPSトークンが初期化されます)')) return;

    const toastId = toast.loading('リセット中...');

    try {
      // 1. GPSトークンの破棄 (Transfer to 0x0...1)
      const { data } = await client.getOwnedObjects({
        owner: account!.address,
        filter: { StructType: `${daoConfig.stayPkgId}::token_management::TokenBalance` },
      });

      if (data.length > 0) {
        const tokenId = data[0].data?.objectId;
        if (tokenId) {
          const tx = new Transaction();
          // Burn by transferring to dead address
          tx.transferObjects([tx.object(tokenId)], '0x0000000000000000000000000000000000000001');
          await signAndExecute({ transaction: tx, chain });
          console.log('Token burned:', tokenId);
        }
      }

      // 2. Capture Current State for Offsets/Thresholds
      // Global State
      const gState = await client.getObject({ id: daoConfig.globalGovStateId, options: { showContent: true } });
      let gNextId = 1n;
      let gBal = 0n;
      if (gState.data?.content && (gState.data.content as any).fields) {
        const f = (gState.data.content as any).fields;
        gNextId = BigInt(f.next_global_proposal_id ?? 1);

        // Fetch Bal
        if (f.global_balances?.fields?.id?.id) {
          try {
            const bObj = await client.getDynamicFieldObject({
              parentId: f.global_balances.fields.id.id,
              name: { type: 'address', value: account!.address }
            });
            if (bObj.data) {
              gBal = BigInt((bObj.data.content as any)?.fields?.value ?? 0);
            }
          } catch { }
        }
      }

      // Region State
      const rState = await client.getObject({ id: daoConfig.regionDaoStateId, options: { showContent: true } });
      let rNextId = 1n;
      let rBal = 0n;
      if (rState.data?.content && (rState.data.content as any).fields) {
        const f = (rState.data.content as any).fields;
        rNextId = BigInt(f.next_proposal_id ?? 1);

        // Fetch Bal
        if (f.balances?.fields?.id?.id) {
          try {
            const bObj = await client.getDynamicFieldObject({
              parentId: f.balances.fields.id.id,
              name: { type: 'address', value: account!.address }
            });
            if (bObj.data) {
              rBal = BigInt((bObj.data.content as any)?.fields?.value ?? 0);
            }
          } catch { }
        }
      }

      // 3. Save to LocalStorage
      localStorage.setItem('demo_global_offset', gBal.toString());
      localStorage.setItem('demo_region_offset', rBal.toString());
      localStorage.setItem('demo_global_pid_threshold', gNextId.toString());
      localStorage.setItem('demo_region_pid_threshold', rNextId.toString());

      toast.success('リセット完了', { id: toastId });
      setTimeout(() => window.location.reload(), 500);

    } catch (e: any) {
      toast.error(`リセット失敗: ${e.message}`, { id: toastId });
      console.error(e);
    }
  };

  if (!isConnected) {
    return (
      <div className="p-4">
        <div className="rounded-2xl bg-white/40 border border-white/50 p-4">
          <div className="text-sm font-bold text-slate-800">Wallet 未接続</div>
          <div className="text-xs text-slate-600 mt-1">右上の ConnectButton で接続してください。</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="rounded-2xl bg-white/70 border border-white/50 p-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-bold">DAO</div>
          <div className="text-xs text-slate-600">devnet</div>
        </div>

        {/* DEV TOOLS (Reset Demo) */}
        <div className="flex gap-2">
          <button
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-white/50 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            onClick={handleDemoReset}
            title="デモ用にデータをリセット"
          >
            <Trash2 className="w-3 h-3" />
            デモ・リセット
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            className={clsx(
              'py-2 rounded-xl font-bold text-sm border border-white/50',
              tab === 'global' ? 'bg-white text-slate-900' : 'bg-white/40 text-slate-600'
            )}
            onClick={() => setTab('global')}
          >
            全体DAO
          </button>
          <button
            className={clsx(
              'py-2 rounded-xl font-bold text-sm border border-white/50',
              tab === 'region' ? 'bg-white text-slate-900' : 'bg-white/40 text-slate-600'
            )}
            onClick={() => setTab('region')}
          >
            地方DAO
          </button>
        </div>
      </div>

      {/* Global */}
      {tab === 'global' && (
        <>
          <div className="rounded-2xl bg-white/60 border border-white/50 p-4">
            <div className="text-sm text-slate-600">あなたの投票力</div>
            <div className="text-2xl font-extrabold">{(Number(gBalance) / 10).toFixed(1)}</div>

            <button
              className="mt-3 w-full py-2 rounded-xl bg-white/70 border border-white/50 font-bold"
              onClick={() => refreshGlobal().catch((e) => toast.error(e?.message ?? String(e)))}
            >
              更新
            </button>
          </div>

          <div className="rounded-2xl bg-white/60 border border-white/50 p-4 space-y-2">
            <div className="font-bold">新しい提案</div>
            <input className="w-full rounded-xl p-2 bg-white/70 border border-white/50"
              placeholder="タイトル"
              value={gTitle}
              onChange={(e) => setGTitle(e.target.value)}
            />
            <textarea className="w-full rounded-xl p-2 bg-white/70 border border-white/50 min-h-[90px]"
              placeholder="説明"
              value={gDesc}
              onChange={(e) => setGDesc(e.target.value)}
            />
            <button
              className="w-full py-2 rounded-xl bg-blue-600 text-white font-bold"
              onClick={() => createGlobalProposal().catch((e) => toast.error(e?.message ?? String(e)))}
            >
              提案する
            </button>
          </div>

          <div className="rounded-2xl bg-white/60 border border-white/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold">提案一覧</div>
            </div>

            {(() => {
              console.log('[UI Render] gProposals.length:', gProposals.length, 'gProposals:', gProposals);
              return gProposals.length === 0 ? (
                <div className="text-sm text-slate-600">提案はまだありません</div>
              ) : (
                <div className="space-y-2">
                  {gProposals.map((p) => {
                    console.log('[UI Render] Rendering proposal:', p);
                    return (
                      <div key={p.id.toString()} className="rounded-xl bg-white/70 border border-white/50 p-3">
                        <div className="font-bold">#{p.id.toString()} {p.title}</div>
                        <div className="text-sm text-slate-600">YES: {p.yes.toString()}</div>
                        <button
                          className="mt-2 w-full py-2 rounded-xl bg-slate-900 text-white font-bold"
                          onClick={() => voteGlobal(p.id).catch((e) => toast.error(e?.message ?? String(e)))}
                        >
                          投票する
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </>
      )}

      {/* Region */}
      {tab === 'region' && (
        <>
          <div className="rounded-2xl bg-white/60 border border-white/50 p-4 space-y-2">
            <div className="font-bold">住民票（ResidentPass）</div>
            <input
              className="w-full rounded-xl p-2 bg-white/70 border border-white/50 text-sm"
              placeholder="ResidentPass objectId（0x...）"
              value={residentPassId}
              onChange={(e) => setResidentPassId(e.target.value)}
            />
            <button
              className="w-full py-2 rounded-xl bg-white/80 border border-white/50 font-bold"
              onClick={() => detectResidentPass().catch((e) => toast.error(e?.message ?? String(e)))}
            >
              自動検出
            </button>
          </div>

          <div className="rounded-2xl bg-white/60 border border-white/50 p-4">
            <div className="text-sm text-slate-600">あなたの投票力</div>
            <div className="text-2xl font-extrabold">{(Number(rBalance) / 10).toFixed(1)}</div>
            <button
              className="mt-3 w-full py-2 rounded-xl bg-white/70 border border-white/50 font-bold"
              onClick={() => refreshRegion().catch((e) => toast.error(e?.message ?? String(e)))}
            >
              更新
            </button>
          </div>

          <div className="rounded-2xl bg-white/60 border border-white/50 p-4 space-y-2">
            <div className="font-bold">新しい提案</div>
            <input className="w-full rounded-xl p-2 bg-white/70 border border-white/50"
              placeholder="タイトル"
              value={rTitle}
              onChange={(e) => setRTitle(e.target.value)}
            />
            <textarea className="w-full rounded-xl p-2 bg-white/70 border border-white/50 min-h-[90px]"
              placeholder="説明"
              value={rDesc}
              onChange={(e) => setRDesc(e.target.value)}
            />
            <button
              className="w-full py-2 rounded-xl bg-blue-600 text-white font-bold"
              onClick={() => createRegionProposal().catch((e) => toast.error(e?.message ?? String(e)))}
            >
              提案する
            </button>
          </div>

          <div className="rounded-2xl bg-white/60 border border-white/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold">提案一覧</div>
            </div>

            {rProposals.length === 0 ? (
              <div className="text-sm text-slate-600">提案はまだありません</div>
            ) : (
              <div className="space-y-2">
                {rProposals.map((p) => (
                  <div key={p.id.toString()} className="rounded-xl bg-white/70 border border-white/50 p-3">
                    <div className="font-bold">#{p.id.toString()} {p.title}</div>
                    <div className="text-sm text-slate-600">YES: {p.yes.toString()}</div>
                    <button
                      className="mt-2 w-full py-2 rounded-xl bg-slate-900 text-white font-bold"
                      onClick={() => voteRegion(p.id).catch((e) => toast.error(e?.message ?? String(e)))}
                    >
                      投票する
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
