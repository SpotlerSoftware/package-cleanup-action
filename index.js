import * as core from '@actions/core'
import {Octokit} from '@octokit/core'
import {paginateRest} from '@octokit/plugin-paginate-rest'
import {restEndpointMethods} from '@octokit/plugin-rest-endpoint-methods'

try {
  const MyOctokit = Octokit.plugin(paginateRest, restEndpointMethods)
  const octokit = new MyOctokit({auth: core.getInput('githubToken')})
  const packageOwner = core.getInput('packageOwner')
  const packageName = core.getInput('packageName')
  const packageType = core.getInput('packageType')
  const packageVersionName = core.getInput('packageVersionName')

  core.debug(`packageOwner: ${packageOwner}`)
  core.debug(`packageName: ${packageName}`)
  core.debug(`packageType: ${packageType}`)
  core.debug(`packageVersionName: ${packageVersionName}`)

  const packages =
    await octokit.rest.packages.getAllPackageVersionsForPackageOwnedByOrg({
      org: packageOwner,
      package_type: packageType,
      package_name: packageName
    })
  core.setOutput('packages:', packages)
} catch (error) {
  core.setFailed(error.message)
}
