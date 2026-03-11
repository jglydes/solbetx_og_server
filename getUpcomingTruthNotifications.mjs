#!/usr/bin/env node
import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { BN } from 'bn.js';
import { readFileSync } from 'fs';

const bettingIDL = JSON.parse(
  readFileSync(new URL('./idls/latest/betting.json', import.meta.url), 'utf8')
);
const truthIDL = JSON.parse(
  readFileSync(new URL('./idls/latest/truth_network.json', import.meta.url), 'utf8')
);

const { AnchorProvider, Program } = anchor;

const RPC_URL = 'https://api.mainnet-beta.solana.com';

const dummyWallet = {
  publicKey: new PublicKey('11111111111111111111111111111111'),
  signAllTransactions: async (txs) => txs,
  signTransaction: async (tx) => tx,
};

export async function getUpcomingTruthNotifications() {
  const connection = new Connection(RPC_URL, 'confirmed');
  const provider = new AnchorProvider(connection, dummyWallet, {
    preflightCommitment: 'processed',
  });

  const bettingProg = new Program(bettingIDL, provider);
  const truthProg = new Program(truthIDL, provider);

  const accounts = await bettingProg.account.bettingQuestion.all();
  console.log("accounts: ", accounts)

  const now = Math.floor(Date.now() / 1000);
  const next48h = now + 48 * 60 * 60;

  const result = [];

  for (const { account } of accounts) {
    try {
      const closeDate = new BN(account.closeDate).toNumber();
      const truthQ = await truthProg.account.question.fetch(account.questionPda);

      const revealEndTime = new BN(truthQ.revealEndTime).toNumber();

      const title =
        truthQ.questionText ||
        truthQ.prompt ||
        truthQ.title ||
        'Untitled question';

      if (now < closeDate && closeDate <= next48h) {
        result.push({
          eventId: account.id.toBase58(),
          questionPda: account.questionPda.toBase58(),
          title,
          type: 'commit_end',
          deadline: closeDate,
          stage: 'commit',
          questionUrl: `https://truth.it.com/question/${account.id.toBase58()}`,
          window: '48h',
        });
      }

      if (now >= closeDate && now < revealEndTime && revealEndTime <= next48h) {
        result.push({
          eventId: account.id.toBase58(),
          questionPda: account.questionPda.toBase58(),
          title,
          type: 'reveal_end',
          deadline: revealEndTime,
          stage: 'reveal',
          questionUrl: `https://truth.it.com/question/${account.id.toBase58()}`,
          window: '48h',
        });
      }
    } catch (e) {
      const msg = e?.message || String(e);

      if (msg.includes('Account does not exist or has no data')) {
        continue;
      }

      console.error('Error for question account:', msg);
    }
  }

  return result;
}