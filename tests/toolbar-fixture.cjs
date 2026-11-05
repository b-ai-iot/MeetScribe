// Existing capture fixtures explicitly open the newly compact-by-default UI.
async function expandToolbar(target){
 const host=target.locator('meetscribe-toolbar'),panel=host.locator('#expanded');
 if(!await panel.isVisible())await host.locator('#compact').click();
 await panel.waitFor({state:'visible'});
}
module.exports={expandToolbar};
