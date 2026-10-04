        <div className="space-y-6">
          {isLoadingChinaImports ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
          ) : chinaImports.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-orange-100 dark:border-orange-900/30 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">China Import</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Products you added from the China Import catalog</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50"><tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Your Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {chinaImports.map(item => {
                      const product = item.product;
                      const image = product?.image_urls?.[0] || product?.image_url;
                      return (
                        <tr key={item.id}>
                          <td className="px-6 py-4"><div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center">
                              {image ? <img src={image} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-gray-400" />}
                            </div>
                            <div><div className="font-medium text-gray-900 dark:text-white">{product?.name || 'China Import product'}</div><div className="text-[11px] text-orange-600">China Import</div></div>
                          </div></td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{product?.category || '—'}</td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">₦{Number(item.seller_price_ngn || 0).toLocaleString()}</td>
                          <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>{item.status === 'active' ? 'Active' : 'Paused'}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

        {/* Seller-to-seller Imports */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          {imports.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No imported products</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">Browse the catalog to import products to your store</p>
              <Button
                onClick={() => setActiveTab('browse')}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                Browse Catalog
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Niche</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Your Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sales</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {imports.map((item) => {
                    const isEditing = editingImportId === item.id;
                    const dropshipCost = item.dropship_price || 0;

                    return (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        {/* Product */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                              {item.images?.[0] ? (
                                <img src={item.images[0]} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white line-clamp-1">{item.name}</span>
                          </div>
                        </td>

                        {/* Niche */}
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                            {item.niche}
                          </span>
                        </td>

                        {/* Price — inline edit */}
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₦</span>
                                <input
                                  type="number"
                                  value={editingPrice}
                                  onChange={e => setEditingPrice(e.target.value)}
                                  className="w-28 pl-6 pr-2 py-1.5 text-sm rounded-lg border border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                                  autoFocus
                                />
                              </div>
                              <button
                                onClick={() => handleSavePrice(item.id, dropshipCost)}
                                className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                                title="Save price"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingImportId(null)}
                                className="p-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-600 dark:text-gray-200 rounded-lg transition-colors"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingImportId(item.id);
                                setEditingPrice(String(item.custom_selling_price || item.selling_price));
                              }}
                              className="group flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-white hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                              title="Click to edit price"
                            >
                              ₦{(item.custom_selling_price || item.selling_price).toLocaleString()}
                              <DollarSign className="w-3.5 h-3.5 text-gray-300 group-hover:text-orange-400 transition-colors" />
                            </button>
                          )}
                        </td>

                        {/* Sales */}
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{item.total_sales || 0}</td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.is_active ? 'bg-green-100 dark:bg-green-500/10 text-green-800 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                          }`}>
                            {item.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleDeleteImport(item.id)}
                            disabled={isDeletingImport === item.id}
                            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                            title="Remove from your store"
                          >
                            {isDeletingImport === item.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <X className="w-3.5 h-3.5" />
                            }
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </div>
      )}

      {/* NEW: Import Configuration Modal */}
      <AnimatePresence>
        {configuringProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Configure Pricing</h2>
                <button onClick={() => setConfiguringProduct(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl mb-6">
                <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden flex-shrink-0">
                  {configuringProduct.images?.[0] ? (
                    <img src={configuringProduct.images[0]} className="w-full h-full object-cover" alt="Product" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white line-clamp-1">{configuringProduct.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Niche: {configuringProduct.niche}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Supplier Price: ₦{configuringProduct.selling_price?.toLocaleString()}</p>
                </div>
              </div>

              {/* Change 4 — Group chat banner */}
              {configuringProduct.store?.group_chat_url && (
                <a
                  href={configuringProduct.store.group_chat_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-800 rounded-xl mb-4 hover:bg-green-100 dark:hover:bg-green-500/20 transition-colors"
                >
                  <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-green-800 dark:text-green-300">Join the seller's group chat</p>
                    <p className="text-xs text-green-600 dark:text-green-400">Get promotional content, videos & updates before importing</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-green-600 flex-shrink-0" />
                </a>
              )}

              <div className="space-y-6">
                <div className="flex justify-between text-sm items-center border-b border-gray-200 dark:border-gray-700 pb-4">
                  <span className="text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> Dropship Base Cost:
                  </span>
                  <span className="font-bold text-gray-900 dark:text-white text-lg">
                    ₦{(configuringProduct.dropship_price || 0).toLocaleString()}
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Set Your Selling Price (₦)</label>
                  {/* Change 1 — ₦ text character instead of DollarSign icon */}
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-base">₦</span>
                    <input 
                      type="number" 
                      value={markupPrice} 
                      onChange={(e) => setMarkupPrice(e.target.value)} 
                      className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-orange-500 outline-none font-bold text-lg text-orange-600" 
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">This is the price your customers will pay on your store.</p>
                </div>

                <div className="p-4 bg-green-50 dark:bg-green-500/10 rounded-xl border border-green-100 dark:border-green-800">
                  <div className="flex justify-between items-center">
                    <span className="text-green-700 dark:text-green-400 text-sm font-medium">Your Profit per Sale:</span>
                    <span className="text-green-700 dark:text-green-400 font-bold text-xl">
                      ₦{Math.max(0, (parseFloat(markupPrice) || 0) - (configuringProduct.dropship_price || 0)).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1 py-6 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" 
                  onClick={() => setConfiguringProduct(null)}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-6" 
                  onClick={handleFinalizeImport} 
                  disabled={isImporting === configuringProduct.id}
                >
                  {isImporting === configuringProduct.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-5 h-5 mr-2" />
                      Add to Store
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}