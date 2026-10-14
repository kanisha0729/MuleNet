import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
from torch_geometric.nn import SAGEConv

class GNNModel(torch.nn.Module):
    def __init__(self, num_nodes, embedding_dim=16):
        super().__init__()
        self.node_emb = torch.nn.Embedding(num_nodes, embedding_dim)
        self.conv1 = SAGEConv(embedding_dim, embedding_dim)
        self.conv2 = SAGEConv(embedding_dim, embedding_dim)
        self.classifier = torch.nn.Linear(embedding_dim * 2, 1)

    def forward(self, edge_index, src, dst):
        x = self.node_emb.weight
        x = self.conv1(x, edge_index)
        x = F.relu(x)
        x = self.conv2(x, edge_index)
        
        edge_repr = torch.cat([x[src], x[dst]], dim=-1)
        return self.classifier(edge_repr).squeeze(), x

def train_gnn(df_train: pd.DataFrame, embedding_dim=16, epochs=20, lr=0.01) -> dict[str, np.ndarray]:
    """Train a GNN on the train split and return account embeddings."""
    print("Training GNN...")
    
    src_accounts = df_train["from_bank"] + "_" + df_train["from_account"]
    dst_accounts = df_train["to_bank"] + "_" + df_train["to_account"]
    all_accounts = pd.concat([src_accounts, dst_accounts]).unique()
    
    account_to_id = {acc: i for i, acc in enumerate(all_accounts)}
    num_nodes = len(all_accounts)
    
    src_ids = src_accounts.map(account_to_id).values
    dst_ids = dst_accounts.map(account_to_id).values
    
    edge_index = torch.tensor(np.vstack([src_ids, dst_ids]), dtype=torch.long)
    y = torch.tensor(df_train["is_laundering"].values, dtype=torch.float32)
    
    model = GNNModel(num_nodes, embedding_dim)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    
    # Handle class imbalance (like XGBoost scale_pos_weight)
    pos_weight = (len(y) - y.sum()) / max(y.sum(), 1.0)
    criterion = torch.nn.BCEWithLogitsLoss(pos_weight=torch.tensor([pos_weight]))
    
    model.train()
    for epoch in range(epochs):
        optimizer.zero_grad()
        out, node_embs = model(edge_index, edge_index[0], edge_index[1])
        loss = criterion(out, y)
        loss.backward()
        optimizer.step()
        if epoch % 5 == 0 or epoch == epochs - 1:
            print(f"GNN Epoch {epoch:02d}, Loss: {loss.item():.4f}")
            
    model.eval()
    with torch.no_grad():
        _, final_embs = model(edge_index, edge_index[0], edge_index[1])
        final_embs_np = final_embs.numpy()
        
    embeddings_dict = {acc: final_embs_np[i] for acc, i in account_to_id.items()}
    print(f"GNN Training complete. Extracted {len(embeddings_dict)} account embeddings.")
    return embeddings_dict
